import { useState } from 'react'

export function CreateLeague({ onSubmit, onCancel, defaultName }: {
  onSubmit: (name: string, creatorName: string) => Promise<unknown>
  onCancel: () => void
  defaultName?: string
}) {
  const [name, setName] = useState('')
  const [creatorName, setCreatorName] = useState(defaultName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit(name.trim(), creatorName.trim() || 'Me')
    } catch (err) {
      console.error('Create league failed:', err)
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string')
          ? (err as { message: string }).message
          : JSON.stringify(err)
      setError(`Failed to create: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="bg-white rounded-2xl shadow p-4 space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <label className="block text-sm">
        League name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Thursday C League"
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Your display name in this league
        <input
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create'}
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
