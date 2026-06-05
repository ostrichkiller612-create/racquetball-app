import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../contacts/useContacts'
import { useMatches } from './useMatches'
import { OpponentPicker } from './OpponentPicker'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function LogCutthroat() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [opp1, setOpp1] = useState<string | null>(null)
  const [opp2, setOpp2] = useState<string | null>(null)
  const [winner, setWinner] = useState<'me' | 'opp1' | 'opp2'>('me')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!opp1 || !opp2) { setError('Pick two opponents.'); return }
    if (opp1 === opp2) { setError('Opponents must be different.'); return }
    setSaving(true); setError(null)
    try {
      await addMatch({
        type: 'cutthroat',
        match_date: date,
        opp1_contact_id: opp1,
        opp2_contact_id: opp2,
        winner,
        notes: notes.trim() || null,
      })
      navigate('/stats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  const opp1Contact = contacts.find((c) => c.id === opp1)
  const opp2Contact = contacts.find((c) => c.id === opp2)

  if (contactsLoading) return <p className="text-sm text-slate-500">Loading contacts…</p>

  return (
    <>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          Date
          <input type="date" value={date} required
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>

        <div>
          <span className="block text-sm mb-1">Opponent 1</span>
          <OpponentPicker contacts={contacts.filter((c) => c.id !== opp2)} value={opp1} onChange={setOpp1} />
        </div>

        <div>
          <span className="block text-sm mb-1">Opponent 2</span>
          <OpponentPicker contacts={contacts.filter((c) => c.id !== opp1)} value={opp2} onChange={setOpp2} />
        </div>

        <fieldset className="bg-white rounded-2xl p-3 shadow space-y-2">
          <legend className="text-sm font-medium">Who won?</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winner === 'me'} onChange={() => setWinner('me')} />
            You
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winner === 'opp1'} onChange={() => setWinner('opp1')} disabled={!opp1} />
            {opp1Contact?.name ?? 'Opponent 1'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winner === 'opp2'} onChange={() => setWinner('opp2')} disabled={!opp2} />
            {opp2Contact?.name ?? 'Opponent 2'}
          </label>
        </fieldset>

        <label className="block text-sm">
          Notes (optional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>

        <button type="submit" disabled={saving || !opp1 || !opp2}
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </>
  )
}
