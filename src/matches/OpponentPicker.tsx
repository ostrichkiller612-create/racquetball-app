import { useMemo, useState } from 'react'
import type { Contact } from '../contacts/useContacts'

export function OpponentPicker({ contacts, value, onChange }: {
  contacts: Contact[]
  value: string | null
  onChange: (contactId: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const selected = contacts.find((c) => c.id === value)

  const filtered = useMemo(() => {
    if (!query) return contacts
    const q = query.toLowerCase()
    return contacts.filter((c) => c.name.toLowerCase().includes(q))
  }, [contacts, query])

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-white border border-slate-300 rounded px-3 py-2">
        <span>{selected.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-sm text-emerald-700"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search contacts…"
        className="block w-full rounded border border-slate-300 px-3 py-2"
      />
      {filtered.length > 0 && (
        <ul className="mt-2 bg-white border border-slate-200 rounded divide-y divide-slate-100 max-h-48 overflow-auto">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onChange(c.id); setQuery('') }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered.length === 0 && contacts.length > 0 && (
        <p className="text-sm text-slate-500 mt-2">No match. Try a different name.</p>
      )}
      {contacts.length === 0 && (
        <p className="text-sm text-slate-500 mt-2">No contacts yet — add one from the More tab.</p>
      )}
    </div>
  )
}
