import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useLeagues } from './useLeagues'
import { useLeagueMembers } from './useLeagueMembers'
import { MemberForm } from './MemberForm'
import { Standings } from './Standings'
import { ScheduleEditor } from './ScheduleEditor'
import { InviteCard } from './InviteCard'

export function League() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const { leagues, deleteLeague } = useLeagues()
  const { members, loading, addMember, updateMember, deleteMember } = useLeagueMembers(id ?? null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const navigate = useNavigate()

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

      {isAdmin && (
        <div className="space-y-2">
          <Link
            to={`/leagues/${id}/import`}
            className="block bg-white rounded-2xl shadow p-3 text-center font-medium text-emerald-700"
          >
            📄 Import roster + schedule
          </Link>
          <Link
            to={`/leagues/${id}/link`}
            className="block bg-white rounded-2xl shadow p-3 text-center font-medium text-emerald-700"
          >
            🔗 Match results to schedule
          </Link>
          <Link
            to={`/leagues/${id}/board`}
            className="block bg-white rounded-2xl shadow p-3 text-center font-medium text-emerald-700"
          >
            🏷 Board points
          </Link>
        </div>
      )}

      <InviteCard leagueId={id} />

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
              <li key={m.id} className="px-4 py-2 text-sm">
                {editingId === m.id ? (
                  <MemberForm
                    defaultSeed={m.seed_number}
                    initial={{
                      seed_number: m.seed_number,
                      name: m.name,
                      phone: m.phone,
                      email: m.email,
                    }}
                    onSubmit={async (input) => {
                      await updateMember(m.id, input)
                      setEditingId(null)
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between">
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
                    {isAdmin && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => setEditingId(m.id)}
                          className="text-emerald-700 text-xs"
                        >
                          Edit
                        </button>
                        {m.user_id !== myId && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${m.name}?`)) deleteMember(m.id)
                            }}
                            className="text-red-600 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl shadow p-3 space-y-2">
          {deleteError && <p className="text-red-600 text-sm">{deleteError}</p>}
          <button
            onClick={async () => {
              if (!league) return
              if (!confirm(`Delete league "${league.name}"? This removes the roster and schedule. Match history is preserved as casual.`)) return
              try {
                await deleteLeague(league.id)
                navigate('/leagues')
              } catch (err) {
                console.error('Delete league failed:', err)
                const msg = err instanceof Error
                  ? err.message
                  : (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string')
                    ? (err as { message: string }).message
                    : JSON.stringify(err)
                setDeleteError(`Delete failed: ${msg}`)
              }
            }}
            className="w-full text-red-600 font-medium py-2"
          >
            Delete league
          </button>
        </div>
      )}
    </div>
  )
}
