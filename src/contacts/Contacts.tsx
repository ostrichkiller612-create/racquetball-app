import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useContacts } from './useContacts'
import { ContactForm } from './ContactForm'

export function Contacts() {
  const { contacts, loading, addContact, deleteContact } = useContacts()
  const [adding, setAdding] = useState(false)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/more" className="text-emerald-700 text-sm">← More</Link>
        <h1 className="text-xl font-semibold">Contacts</h1>
        <span className="w-10" />
      </div>

      {adding ? (
        <ContactForm onSubmit={addContact} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded bg-emerald-600 text-white py-2 font-medium"
        >
          + Add contact
        </button>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No contacts yet.</p>
      ) : (
        <ul className="bg-white rounded-2xl shadow divide-y divide-slate-200">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{c.name}</div>
                {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete ${c.name}?`)) deleteContact(c.id)
                }}
                className="text-sm text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
