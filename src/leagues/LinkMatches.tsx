import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useLeagueMembers } from './useLeagueMembers'
import { useLeagueSchedule } from './useLeagueSchedule'
import { proposeLinks, type ProposedLink } from './linkMatching'
import type { Match } from '../matches/useMatches'

type Row = ProposedLink & { include: boolean }

export function LinkMatches() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const { members } = useLeagueMembers(id ?? null)
  const { schedule, loading: scheduleLoading } = useLeagueSchedule(id ?? null)
  const navigate = useNavigate()

  const [rows, setRows] = useState<Row[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const me = session?.user.id
    if (!me || scheduleLoading || members.length === 0) return
    let active = true
    ;(async () => {
      const [{ data: matches }, { data: contacts }] = await Promise.all([
        supabase.from('matches').select('*').eq('match_type', 'singles'),
        supabase.from('contacts').select('id, name'),
      ])
      if (!active) return
      const contactNames = new Map(
        ((contacts ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
      )
      const links = proposeLinks(
        schedule,
        (matches ?? []) as Match[],
        members,
        contactNames,
      )
      setRows(links.map((l) => ({ ...l, include: true })))
    })()
    return () => {
      active = false
    }
  }, [session, schedule, scheduleLoading, members])

  async function handleSave() {
    if (!rows) return
    setSaving(true)
    setError(null)
    try {
      const selected = rows.filter((r) => r.include)
      for (const r of selected) {
        const { error: linkErr } = await supabase
          .from('league_schedule')
          .update({ match_id: r.matchId })
          .eq('id', r.scheduleId)
        if (linkErr) {
          throw new Error(`Linking week ${r.weekNumber}: ${linkErr.message}`)
        }
        // Adopt the match into the league. Only works for matches the current
        // user entered (RLS) — ignore failures, the schedule link is what matters.
        await supabase
          .from('matches')
          .update({ league_id: id })
          .eq('id', r.matchId)
      }
      navigate(`/leagues/${id}`)
    } catch (err) {
      console.error('Link save failed:', err)
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setSaving(false)
    }
  }

  function toggle(i: number) {
    setRows((prev) =>
      prev ? prev.map((r, idx) => (idx === i ? { ...r, include: !r.include } : r)) : prev,
    )
  }

  if (!id) return <div className="p-4">Invalid league</div>

  const unlinkedCount = schedule.filter((s) => !s.match_id).length

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to={`/leagues/${id}`} className="text-emerald-300 text-sm">← League</Link>
        <h1 className="text-xl font-semibold">Match results</h1>
        <span className="w-10" />
      </div>

      {error && (
        <div className="bg-white rounded-2xl shadow p-3 text-red-600 text-sm">{error}</div>
      )}

      {rows === null ? (
        <div className="bg-white rounded-2xl shadow p-4 text-sm">Scanning your logged matches…</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-4 text-sm text-slate-600">
          No pairings found. {unlinkedCount} schedule row{unlinkedCount === 1 ? '' : 's'} still
          unlinked — matches pair when the opponent and date (±3 days) line up with a logged
          singles match.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow">
            <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">
              Proposed pairings ({rows.filter((r) => r.include).length})
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <li key={r.scheduleId} className="p-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={() => toggle(i)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs text-slate-500">
                      Week {r.weekNumber} · scheduled {r.scheduleDate}
                      {r.matchDate !== r.scheduleDate && ` · played ${r.matchDate}`}
                    </div>
                    <div className="font-medium">
                      {r.player1Name} vs {r.player2Name}
                    </div>
                    <div className="text-emerald-700 font-semibold">
                      {r.player1Games}–{r.player2Games}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || rows.filter((r) => r.include).length === 0}
            className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
          >
            {saving ? 'Linking…' : `Link ${rows.filter((r) => r.include).length} result${rows.filter((r) => r.include).length === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </div>
  )
}
