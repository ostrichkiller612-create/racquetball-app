import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../lib/supabase'

export function ProfileEdit() {
  const { session } = useAuth()
  const me = session?.user.id

  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [template, setTemplate] = useState(
    "Hey just verifying our match for {date}. sent via Jim's racquetball app",
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!me) return
    let active = true
    supabase
      .from('profiles')
      .select('display_name, phone, default_text_template')
      .eq('id', me)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        if (data) {
          setDisplayName(data.display_name ?? '')
          setPhone(data.phone ?? '')
          if (data.default_text_template) setTemplate(data.default_text_template)
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [me])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!me) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        phone: phone || null,
        default_text_template: template,
        updated_at: new Date().toISOString(),
      })
      .eq('id', me)
    setSaving(false)
    if (error) setError(error.message)
    else setSaved(true)
  }

  if (loading) return <div className="p-4">Loading profile…</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/more" className="text-emerald-300 text-sm">← More</Link>
        <h1 className="text-xl font-semibold">Profile</h1>
        <span className="w-10" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-4 space-y-3">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {saved && <p className="text-emerald-700 text-sm">Saved.</p>}
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
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Default text-opponent template
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
          <span className="block text-xs text-slate-500 mt-1">
            Placeholders you can use: {'{name}'}, {'{date}'}, {'{time}'}, {'{court}'}, {'{when}'} (date + time combined).
          </span>
        </label>
        <button
          type="submit"
          disabled={saving || !displayName.trim()}
          className="w-full rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
