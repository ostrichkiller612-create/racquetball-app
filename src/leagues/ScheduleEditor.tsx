import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLeagueSchedule } from './useLeagueSchedule'
import type { LeagueMember } from './useLeagueMembers'

type LinkedResult = {
  player1_user_id: string | null
  player2_user_id: string | null
  player1_games_won: number
  player2_games_won: number
}

export function ScheduleEditor({ leagueId, members, isAdmin }: {
  leagueId: string
  members: LeagueMember[]
  isAdmin: boolean
}) {
  const { schedule, loading, addRow, deleteRow } = useLeagueSchedule(leagueId)
  const [resultsById, setResultsById] = useState<Map<string, LinkedResult>>(new Map())

  useEffect(() => {
    const ids = schedule.map((s) => s.match_id).filter((x): x is string => x !== null)
    if (ids.length === 0) {
      setResultsById(new Map())
      return
    }
    let active = true
    supabase
      .from('matches')
      .select('id, player1_user_id, player2_user_id, player1_games_won, player2_games_won')
      .in('id', ids)
      .then(({ data }) => {
        if (!active) return
        setResultsById(
          new Map(
            ((data ?? []) as Array<LinkedResult & { id: string }>).map((m) => [m.id, m]),
          ),
        )
      })
    return () => {
      active = false
    }
  }, [schedule])
  const [adding, setAdding] = useState(false)
  const [weekNumber, setWeekNumber] = useState(1)
  const [matchDate, setMatchDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [court, setCourt] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const memberById = new Map(members.map((m) => [m.id, m]))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!matchDate || !p1 || !p2 || p1 === p2) {
      setError('Need a date and two different players.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addRow({
        week_number: weekNumber,
        match_date: matchDate,
        start_time: startTime || null,
        court: court || null,
        player1_member_id: p1,
        player2_member_id: p2,
      })
      setAdding(false)
      setMatchDate('')
      setStartTime('')
      setCourt('')
      setP1('')
      setP2('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b flex items-center justify-between">
        <span>Schedule ({schedule.length})</span>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="text-emerald-700 text-sm">
            + Add match
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="p-3 space-y-2 border-b">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <label className="text-sm w-20">
              Week
              <input
                type="number"
                min={1}
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-2"
              />
            </label>
            <label className="text-sm flex-1">
              Date
              <input
                type="date"
                value={matchDate}
                required
                onChange={(e) => setMatchDate(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="text-sm flex-1">
              Time
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm w-20">
              Court
              <input
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            Player 1
            <select
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">— pick —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.seed_number} {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Player 2
            <select
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">— pick —</option>
              {members
                .filter((m) => m.id !== p1)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.seed_number} {m.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 rounded border border-slate-300 py-2 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="p-3 text-sm text-slate-500">Loading…</p>
      ) : schedule.length === 0 ? (
        <p className="p-3 text-sm text-slate-500">No matches scheduled yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {schedule.map((s) => {
            const p1m = s.player1_member_id ? memberById.get(s.player1_member_id) : null
            const p2m = s.player2_member_id ? memberById.get(s.player2_member_id) : null
            const result = s.match_id ? resultsById.get(s.match_id) : null
            // Orient the score to the schedule's player1 when possible.
            let chip: string | null = null
            if (result) {
              let g1 = result.player1_games_won
              let g2 = result.player2_games_won
              if (
                p1m?.user_id &&
                result.player2_user_id === p1m.user_id
              ) {
                ;[g1, g2] = [g2, g1]
              } else if (
                p2m?.user_id &&
                result.player1_user_id === p2m.user_id
              ) {
                ;[g1, g2] = [g2, g1]
              }
              chip = `${g1}–${g2}`
            }
            return (
              <li key={s.id} className="px-4 py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">
                    Week {s.week_number} — {s.match_date}
                    {s.start_time && ` @ ${s.start_time.slice(0, 5)}`}
                    {s.court && ` · Court ${s.court}`}
                  </div>
                  <div className="font-medium">
                    {p1m ? `#${p1m.seed_number} ${p1m.name}` : '(?)'} vs{' '}
                    {p2m ? `#${p2m.seed_number} ${p2m.name}` : '(?)'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {chip && (
                    <span className="text-emerald-700 font-semibold">{chip} ✓</span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this match?')) deleteRow(s.id)
                      }}
                      className="text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
