import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import type { Match } from './useMatches'

export function EditMatch() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [match, setMatch] = useState<Match | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [date, setDate] = useState('')
  const [yourGames, setYourGames] = useState(0)
  const [theirGames, setTheirGames] = useState(0)
  const [winnerPosition, setWinnerPosition] = useState<number>(1)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    supabase
      .from('matches')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        if (!data) {
          setNotFound(true)
          return
        }
        const m = data as Match
        setMatch(m)
        setDate(m.match_date)
        setYourGames(m.player1_games_won)
        setTheirGames(m.player2_games_won)
        setWinnerPosition(m.winner_position ?? 1)
        setNotes(m.notes ?? '')
      })
    return () => {
      active = false
    }
  }, [id])

  const isMine = !!(match && session && match.entered_by === session.user.id)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!match) return
    if (match.match_type === 'singles' && yourGames === theirGames) {
      setError('Ties are not allowed.')
      return
    }
    setSaving(true)
    setError(null)
    const patch: Record<string, unknown> = {
      match_date: date,
      notes: notes.trim() || null,
    }
    if (match.match_type === 'singles') {
      patch.player1_games_won = yourGames
      patch.player2_games_won = theirGames
    } else {
      patch.winner_position = winnerPosition
    }
    const { error: upErr } = await supabase.from('matches').update(patch).eq('id', match.id)
    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    navigate('/stats')
  }

  async function handleDelete() {
    if (!match) return
    if (!confirm('Delete this match? This cannot be undone.')) return
    setSaving(true)
    const { error: delErr } = await supabase.from('matches').delete().eq('id', match.id)
    setSaving(false)
    if (delErr) {
      setError(delErr.message)
      return
    }
    navigate('/stats')
  }

  if (notFound) return <div className="p-4">Match not found.</div>
  if (!match) return <div className="p-4">Loading…</div>

  const typeLabel =
    match.match_type === 'singles' ? 'Singles'
    : match.match_type === 'cutthroat' ? 'Cutthroat'
    : 'Doubles'

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/stats" className="text-emerald-300 text-sm">← Stats</Link>
        <h1 className="text-xl font-semibold">{typeLabel} match</h1>
        <span className="w-10" />
      </div>

      {error && (
        <div className="bg-white rounded-2xl shadow p-3 text-red-600 text-sm">{error}</div>
      )}

      {!isMine ? (
        <div className="bg-white rounded-2xl shadow p-4 text-sm text-slate-600 space-y-1">
          <p>
            {match.match_date} — score {match.player1_games_won}–{match.player2_games_won}
          </p>
          {match.notes && <p className="text-slate-500">{match.notes}</p>}
          <p className="text-xs text-slate-400 pt-1">
            Only the person who logged this match can edit it.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow p-4 space-y-4">
          <label className="block text-sm">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          {match.match_type === 'singles' ? (
            <div className="flex gap-3">
              <label className="flex-1 text-sm">
                Your games
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={yourGames}
                  onChange={(e) => setYourGames(Number(e.target.value))}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex-1 text-sm">
                Their games
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={theirGames}
                  onChange={(e) => setTheirGames(Number(e.target.value))}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          ) : (
            <label className="block text-sm">
              Winner position ({match.match_type === 'cutthroat' ? '1 = you, 2 = opponent 1, 3 = opponent 2' : '1 = your team, 2 = their team'})
              <select
                value={winnerPosition}
                onChange={(e) => setWinnerPosition(Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 bg-white"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                {match.match_type === 'cutthroat' && <option value={3}>3</option>}
              </select>
            </label>
          )}

          <label className="block text-sm">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="w-full text-red-600 font-medium py-2"
          >
            Delete match
          </button>
        </form>
      )}
    </div>
  )
}
