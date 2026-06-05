import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../contacts/useContacts'
import { useLeagues } from '../leagues/useLeagues'
import { useLeagueMembers } from '../leagues/useLeagueMembers'
import { useMatches } from './useMatches'
import { OpponentPicker } from './OpponentPicker'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function LogMatch() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { leagues, loading: leaguesLoading } = useLeagues()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [leagueId, setLeagueId] = useState<string>('') // '' = casual
  const [opponentContactId, setOpponentContactId] = useState<string | null>(null)
  const [opponentUserId, setOpponentUserId] = useState<string | null>(null)
  const [yourGames, setYourGames] = useState<number>(2)
  const [theirGames, setTheirGames] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only fetch members when a league is selected
  const { members } = useLeagueMembers(leagueId || null)

  function handleLeagueChange(newLeagueId: string) {
    setLeagueId(newLeagueId)
    setOpponentContactId(null)
    setOpponentUserId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const haveOpponent = leagueId ? opponentUserId : opponentContactId
    if (!haveOpponent) {
      setError('Pick an opponent first.')
      return
    }
    if (yourGames === theirGames) {
      setError('Ties are not allowed.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addMatch({
        match_date: date,
        league_id: leagueId || null,
        opponent_user_id: leagueId ? opponentUserId : null,
        opponent_contact_id: leagueId ? null : opponentContactId,
        your_games: yourGames,
        their_games: theirGames,
        notes: notes.trim() || null,
      })
      navigate('/stats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  // League members that are real users (not placeholders)
  const playableMembers = members.filter((m) => m.user_id !== null)
  const selectedMember = playableMembers.find((m) => m.user_id === opponentUserId)

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Log Match</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
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

        {!leaguesLoading && leagues.length > 0 && (
          <label className="block text-sm">
            League
            <select
              value={leagueId}
              onChange={(e) => handleLeagueChange(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">Casual (no league)</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div>
          <span className="block text-sm mb-1">Opponent</span>
          {leagueId ? (
            // League opponent picker — uses league members
            selectedMember ? (
              <div className="flex items-center justify-between bg-white border border-slate-300 rounded px-3 py-2">
                <span>
                  #{selectedMember.seed_number} {selectedMember.name}
                </span>
                <button
                  type="button"
                  onClick={() => setOpponentUserId(null)}
                  className="text-sm text-emerald-700"
                >
                  Change
                </button>
              </div>
            ) : playableMembers.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active members in this league yet. Add members who have signed up.
              </p>
            ) : (
              <ul className="bg-white border border-slate-200 rounded divide-y divide-slate-100 max-h-48 overflow-auto">
                {playableMembers.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setOpponentUserId(m.user_id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                    >
                      #{m.seed_number} {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : contactsLoading ? (
            <p className="text-sm text-slate-500">Loading contacts…</p>
          ) : (
            <OpponentPicker
              contacts={contacts}
              value={opponentContactId}
              onChange={setOpponentContactId}
            />
          )}
        </div>

        <div className="flex gap-3">
          <label className="flex-1 text-sm">
            Your games
            <input
              type="number"
              min={0}
              max={3}
              value={yourGames}
              onChange={(e) => setYourGames(Number(e.target.value))}
              required
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
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={
            saving || (leagueId ? !opponentUserId : !opponentContactId)
          }
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </div>
  )
}
