import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLeagues } from './useLeagues'
import { CreateLeague } from './CreateLeague'

export function Leagues() {
  const { leagues, loading, createLeague } = useLeagues()
  const [creating, setCreating] = useState(false)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/more" className="text-emerald-300 text-sm">← More</Link>
        <h1 className="text-xl font-semibold">Leagues</h1>
        <span className="w-10" />
      </div>

      {creating ? (
        <CreateLeague
          onSubmit={async (name, creatorName) => {
            await createLeague({ name, creatorName })
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded bg-emerald-600 text-white py-2 font-medium"
        >
          + Create league
        </button>
      )}

      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : leagues.length === 0 ? (
        <p className="text-sm text-slate-300 text-center py-6">
          No leagues yet. Create one or wait for an invite.
        </p>
      ) : (
        <ul className="bg-white rounded-2xl shadow divide-y divide-slate-200">
          {leagues.map((l) => (
            <li key={l.id}>
              <Link to={`/leagues/${l.id}`} className="block p-3 font-medium">
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
