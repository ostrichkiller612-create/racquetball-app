import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

type JoinInfo = {
  league_name: string | null
  members: Array<{ id: string; seed_number: number; name: string; claimed: boolean }>
}

export const PENDING_JOIN_KEY = 'pendingJoinLeague'

export function JoinLeague() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const { session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [info, setInfo] = useState<JoinInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  // Signed out: remember where we were headed, send to sign-in.
  useEffect(() => {
    if (authLoading) return
    if (!session && leagueId) {
      localStorage.setItem(PENDING_JOIN_KEY, leagueId)
      navigate('/signin', { replace: true })
    }
  }, [authLoading, session, leagueId, navigate])

  // Signed in: we've arrived — clear any pending marker and load join info.
  useEffect(() => {
    if (!session || !leagueId) return
    localStorage.removeItem(PENDING_JOIN_KEY)
    let active = true
    supabase
      .rpc('get_league_join_info', { p_league: leagueId })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setInfo(data as JoinInfo)
      })
    return () => {
      active = false
    }
  }, [session, leagueId])

  async function handleClaim(memberId: string, name: string) {
    if (!confirm(`Claim the spot for ${name}? This connects your account to their schedule and results.`)) {
      return
    }
    setClaiming(true)
    setError(null)
    const { data, error } = await supabase.rpc('claim_league_member', { p_member: memberId })
    setClaiming(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/leagues/${data}`)
  }

  if (authLoading || (!session && leagueId)) {
    return <div className="p-6">Loading…</div>
  }
  if (!leagueId) return <div className="p-6">Invalid invite link.</div>

  const unclaimed = info?.members.filter((m) => !m.claimed) ?? []

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold text-center pt-4">
        Join {info?.league_name ?? 'league'}
      </h1>

      {error && (
        <div className="bg-white rounded-2xl shadow p-3 text-red-600 text-sm">{error}</div>
      )}

      {info === null ? (
        <div className="bg-white rounded-2xl shadow p-4 text-sm">Loading league…</div>
      ) : info.league_name === null ? (
        <div className="bg-white rounded-2xl shadow p-4 text-sm text-slate-600">
          This league doesn't exist (the invite link may be stale).
        </div>
      ) : unclaimed.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-4 text-sm text-slate-600">
          Every spot in this league has been claimed. Ask the league admin to add you to the roster.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow">
          <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">
            Which one are you?
          </div>
          <ul className="divide-y divide-slate-100">
            {unclaimed.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => handleClaim(m.id, m.name)}
                  disabled={claiming}
                  className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="text-slate-400 mr-2">#{m.seed_number}</span>
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => navigate('/')}
        className="block w-full text-center text-sm text-emerald-300"
      >
        Skip — just take me to the app
      </button>
    </div>
  )
}
