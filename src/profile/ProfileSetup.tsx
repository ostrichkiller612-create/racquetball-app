import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function ProfileSetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      display_name: displayName,
      phone: phone || null,
    })
    setSaving(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold">Welcome — finish setup</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <label className="block text-sm">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Phone (optional)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !displayName}
          className="w-full rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
