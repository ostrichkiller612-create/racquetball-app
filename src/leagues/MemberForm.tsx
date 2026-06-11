import { useState } from 'react'
import type { NewMember } from './useLeagueMembers'

export function MemberForm({ onSubmit, onCancel, defaultSeed, initial }: {
  onSubmit: (input: NewMember) => Promise<unknown>
  onCancel: () => void
  defaultSeed: number
  initial?: NewMember
}) {
  const [seed, setSeed] = useState(initial?.seed_number ?? defaultSeed)
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        seed_number: seed,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="bg-white rounded-2xl shadow p-4 space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <label className="block text-sm w-20">
          Seed #
          <input
            type="number"
            min={1}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-2"
          />
        </label>
        <label className="block text-sm flex-1">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
      </div>
      <label className="block text-sm">
        Phone (optional)
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Email (optional — lets them auto-join when they sign up)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Save' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded border border-slate-300 py-2 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
