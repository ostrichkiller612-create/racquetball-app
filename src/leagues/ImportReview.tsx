import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ensureContacts } from './syncContacts'
import type { ParsedRosterEntry } from '../lib/parseRosterText'
import type { ParsedScheduleRow } from '../lib/parseScheduleText'
import type { LeagueMember } from './useLeagueMembers'

type MemberRow = {
  include: boolean
  seed: number
  name: string
  phone: string
  email: string
  existingId: string | null
}

type ScheduleRow = {
  include: boolean
  week: number
  date: string
  time: string
  court: string
  p1Seed: number
  p2Seed: number
}

export function ImportReview({
  leagueId,
  parsedRoster,
  parsedSchedule,
  existingMembers,
  onCancel,
}: {
  leagueId: string
  year: number
  parsedRoster: ParsedRosterEntry[]
  parsedSchedule: ParsedScheduleRow[]
  existingMembers: LeagueMember[]
  onCancel: () => void
}) {
  const navigate = useNavigate()

  const startSeed = existingMembers.length > 0
    ? Math.max(...existingMembers.map((m) => m.seed_number)) + 1
    : 1

  const initialMembers: MemberRow[] = useMemo(() => {
    return parsedRoster.map((r, i) => {
      const existing = existingMembers.find(
        (m) => m.name.trim().toLowerCase() === r.name.trim().toLowerCase(),
      )
      return {
        include: existing == null,
        seed: existing?.seed_number ?? startSeed + i,
        name: r.name,
        phone: r.phone ?? '',
        email: '',
        existingId: existing?.id ?? null,
      }
    })
  }, [parsedRoster, existingMembers, startSeed])

  const [members, setMembers] = useState<MemberRow[]>(initialMembers)
  const [schedule, setSchedule] = useState<ScheduleRow[]>(
    parsedSchedule.map((s) => ({
      include: true,
      week: s.week_number,
      date: s.match_date,
      time: s.start_time ?? '',
      court: s.court ?? '',
      p1Seed: s.player1_seed,
      p2Seed: s.player2_seed,
    })),
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateMember(i: number, patch: Partial<MemberRow>) {
    setMembers((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function updateSchedule(i: number, patch: Partial<ScheduleRow>) {
    setSchedule((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const newMembers = members.filter((m) => m.include && !m.existingId && m.name.trim())
      const insertedById = new Map<number, string>()
      for (const m of newMembers) {
        const { data, error: insErr } = await supabase
          .from('league_members')
          .insert({
            league_id: leagueId,
            seed_number: m.seed,
            name: m.name.trim(),
            phone: m.phone.trim() || null,
            email: m.email.trim() || null,
            role: 'member',
          })
          .select('id, seed_number')
          .single()
        if (insErr) {
          console.error('Member insert failed:', insErr, 'row:', m)
          throw new Error(`Member "${m.name}" (seed ${m.seed}): ${insErr.message ?? insErr.code ?? JSON.stringify(insErr)}`)
        }
        insertedById.set(data.seed_number, data.id)
      }

      const seedToId = new Map<number, string>()
      for (const m of existingMembers) seedToId.set(m.seed_number, m.id)
      for (const [seed, mid] of insertedById) seedToId.set(seed, mid)
      for (const m of members) {
        if (m.existingId) seedToId.set(m.seed, m.existingId)
      }

      const toInsert = schedule
        .filter((s) => s.include && s.date && s.p1Seed && s.p2Seed && s.p1Seed !== s.p2Seed)
        .map((s) => ({
          league_id: leagueId,
          week_number: s.week,
          match_date: s.date,
          start_time: s.time || null,
          court: s.court || null,
          player1_member_id: seedToId.get(s.p1Seed) ?? null,
          player2_member_id: seedToId.get(s.p2Seed) ?? null,
        }))

      // Warn about schedule rows that reference seeds we couldn't resolve
      const unresolved = toInsert.filter(
        (r) => !r.player1_member_id || !r.player2_member_id,
      )
      if (unresolved.length > 0) {
        console.warn(`${unresolved.length} schedule rows have unresolved seeds and will be skipped.`)
      }
      const resolved = toInsert.filter(
        (r) => r.player1_member_id && r.player2_member_id,
      )

      if (resolved.length > 0) {
        const { error: schedErr } = await supabase.from('league_schedule').insert(resolved)
        if (schedErr) {
          console.error('Schedule insert failed:', schedErr, 'first row:', resolved[0])
          throw new Error(
            `Schedule insert: ${schedErr.message ?? schedErr.code ?? JSON.stringify(schedErr)}`,
          )
        }
      }

      // Mirror the roster into the importer's contacts so match logging and
      // name-based linking work out of the box. Best-effort.
      try {
        await ensureContacts(
          members
            .filter((m) => m.include && m.name.trim())
            .map((m) => ({ name: m.name, phone: m.phone || null })),
        )
      } catch (err) {
        console.warn('Contact sync after import failed:', err)
      }

      navigate(`/leagues/${leagueId}`)
    } catch (err) {
      console.error('Save failed:', err)
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      setError(`Save failed — ${msg}`)
      setSaving(false)
    }
  }

  const includedMemberCount = members.filter((m) => m.include).length
  const includedScheduleCount = schedule.filter((s) => s.include).length

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">
          Members ({includedMemberCount} to add, {members.filter((m) => m.existingId).length} already in league)
        </div>
        {members.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">No members detected.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m, i) => (
              <li key={i} className="p-2 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={m.include}
                    onChange={(e) => updateMember(i, { include: e.target.checked })}
                  />
                  <input
                    type="number"
                    value={m.seed}
                    onChange={(e) => updateMember(i, { seed: Number(e.target.value) })}
                    className="w-14 rounded border border-slate-300 px-1 py-1"
                    disabled={!!m.existingId}
                  />
                  <input
                    value={m.name}
                    onChange={(e) => updateMember(i, { name: e.target.value })}
                    className="flex-1 rounded border border-slate-300 px-2 py-1"
                    disabled={!!m.existingId}
                  />
                  {m.existingId && <span className="text-xs text-slate-400">(existing)</span>}
                </div>
                {!m.existingId && (
                  <div className="flex gap-2">
                    <input
                      value={m.phone}
                      placeholder="Phone"
                      onChange={(e) => updateMember(i, { phone: e.target.value })}
                      className="flex-1 rounded border border-slate-300 px-2 py-1"
                    />
                    <input
                      value={m.email}
                      placeholder="Email (optional)"
                      onChange={(e) => updateMember(i, { email: e.target.value })}
                      className="flex-1 rounded border border-slate-300 px-2 py-1"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">
          Schedule ({includedScheduleCount} to add)
        </div>
        {schedule.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">No schedule rows detected.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schedule.map((s, i) => (
              <li key={i} className="p-2 space-y-1 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="checkbox"
                    checked={s.include}
                    onChange={(e) => updateSchedule(i, { include: e.target.checked })}
                  />
                  <span className="text-xs text-slate-400">Wk {s.week}</span>
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) => updateSchedule(i, { date: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-1"
                  />
                  <input
                    type="time"
                    value={s.time}
                    onChange={(e) => updateSchedule(i, { time: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-1 w-24"
                  />
                  <input
                    value={s.court}
                    placeholder="Court"
                    onChange={(e) => updateSchedule(i, { court: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-1 w-16"
                  />
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-slate-500 text-xs">P1</span>
                  <input
                    type="number"
                    value={s.p1Seed}
                    onChange={(e) => updateSchedule(i, { p1Seed: Number(e.target.value) })}
                    className="w-14 rounded border border-slate-300 px-1 py-1"
                  />
                  <span className="text-slate-500 text-xs">vs P2</span>
                  <input
                    type="number"
                    value={s.p2Seed}
                    onChange={(e) => updateSchedule(i, { p2Seed: Number(e.target.value) })}
                    className="w-14 rounded border border-slate-300 px-1 py-1"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || (includedMemberCount === 0 && includedScheduleCount === 0)}
          className="flex-1 rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : `Save ${includedMemberCount} + ${includedScheduleCount}`}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded border border-slate-300 bg-white py-3 font-medium"
        >
          Re-pick file
        </button>
      </div>
    </div>
  )
}
