import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../contacts/useContacts'
import { useMatches } from './useMatches'
import { OpponentPicker } from './OpponentPicker'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function LogMatch() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [opponentId, setOpponentId] = useState<string | null>(null)
  const [yourGames, setYourGames] = useState<number>(2)
  const [theirGames, setTheirGames] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!opponentId) {
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
        opponent_contact_id: opponentId,
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

        <div>
          <span className="block text-sm mb-1">Opponent</span>
          {contactsLoading ? (
            <p className="text-sm text-slate-500">Loading contacts…</p>
          ) : (
            <OpponentPicker contacts={contacts} value={opponentId} onChange={setOpponentId} />
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
          disabled={saving || !opponentId}
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </div>
  )
}
