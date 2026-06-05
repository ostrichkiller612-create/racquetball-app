import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../contacts/useContacts'
import { useMatches } from './useMatches'
import { OpponentPicker } from './OpponentPicker'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function LogDoubles() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [partner, setPartner] = useState<string | null>(null)
  const [opp1, setOpp1] = useState<string | null>(null)
  const [opp2, setOpp2] = useState<string | null>(null)
  const [winningTeam, setWinningTeam] = useState<'mine' | 'theirs'>('mine')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partner || !opp1 || !opp2) { setError('Pick a partner and two opponents.'); return }
    const ids = new Set([partner, opp1, opp2])
    if (ids.size !== 3) { setError('All three must be different.'); return }
    setSaving(true); setError(null)
    try {
      await addMatch({
        type: 'doubles',
        match_date: date,
        partner_contact_id: partner,
        opp1_contact_id: opp1,
        opp2_contact_id: opp2,
        winning_team: winningTeam,
        notes: notes.trim() || null,
      })
      navigate('/stats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  if (contactsLoading) return <p className="text-sm text-slate-500">Loading contacts…</p>

  const taken = new Set([partner, opp1, opp2].filter(Boolean) as string[])

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
          <span className="block text-sm mb-1">Your partner</span>
          <OpponentPicker contacts={contacts.filter((c) => !taken.has(c.id) || c.id === partner)} value={partner} onChange={setPartner} />
        </div>

        <div>
          <span className="block text-sm mb-1">Opponent 1</span>
          <OpponentPicker contacts={contacts.filter((c) => !taken.has(c.id) || c.id === opp1)} value={opp1} onChange={setOpp1} />
        </div>

        <div>
          <span className="block text-sm mb-1">Opponent 2</span>
          <OpponentPicker contacts={contacts.filter((c) => !taken.has(c.id) || c.id === opp2)} value={opp2} onChange={setOpp2} />
        </div>

        <fieldset className="bg-white rounded-2xl p-3 shadow space-y-2">
          <legend className="text-sm font-medium">Winning team?</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winningTeam === 'mine'} onChange={() => setWinningTeam('mine')} />
            Your team (you + partner)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winningTeam === 'theirs'} onChange={() => setWinningTeam('theirs')} />
            Their team
          </label>
        </fieldset>

        <label className="block text-sm">
          Notes (optional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>

        <button type="submit" disabled={saving || !partner || !opp1 || !opp2}
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </>
  )
}
