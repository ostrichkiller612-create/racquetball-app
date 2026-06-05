import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useLeagues } from './useLeagues'
import { useLeagueMembers } from './useLeagueMembers'
import { MemberForm } from './MemberForm'
import { Standings } from './Standings'
import { ScheduleEditor } from './ScheduleEditor'

export function League() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const { leagues } = useLeagues()
  const { members, loading, addMember, deleteMember } = useLeagueMembers(id ?? null)
  const [adding, setAdding] = useState(false)

  const league = leagues.find((l) => l.id === id)
  const myId = session?.user.id
  const isAdmin = !!(league && myId && league.created_by === myId)

  if (!id) return <div className="p-4">Invalid league</div>

  const nextSeed =
    members.length > 0 ? Math.max(...members.map((m) => m.seed_number)) + 1 : 1

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/leagues" className="text-emerald-300 text-sm">← Leagues</Link>
        <h1 className="text-xl font-semibold">{league?.name ?? 'League'}</h1>
        <span className="w-10" />
      </div>

      <Standings leagueId={id} members={members} />

      <ScheduleEditor leagueId={id} members={members} isAdmin={isAdmin} />

      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b flex items-center justify-between">
          <span>Roster ({members.length})</span>
          {isAdmin && !adding && (
            <button onClick={() => setAdding(true)} className="text-emerald-700 text-sm">
              + Add member
            </button>
          )}
        </div>

        {adding && (
          <div className="p-3">
            <MemberForm
              defaultSeed={nextSeed}
              onSubmit={async (input) => {
                await addMember(input)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {loading ? (
          <p className="p-3 text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li
                key={m.id}
                className="px-4 py-2 flex items-center justify-between text-sm"
              >
                <div>
                  <span className="text-slate-400 w-6 inline-block">#{m.seed_number}</span>
                  <span className="font-medium">{m.name}</span>
                  {m.user_id == null && (
                    <span className="ml-2 text-xs text-slate-400">(invited)</span>
                  )}
                  {m.role === 'admin' && (
                    <span className="ml-2 text-xs text-emerald-700">admin</span>
                  )}
                </div>
                {isAdmin && m.user_id !== myId && (
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${m.name}?`)) deleteMember(m.id)
                    }}
                    className="text-red-600 text-xs"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
