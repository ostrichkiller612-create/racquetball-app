import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { leagueStandings, type LeagueStanding } from '../lib/scoring'
import type { LeagueMember } from './useLeagueMembers'

export function Standings({ leagueId, members }: { leagueId: string; members: LeagueMember[] }) {
  const [rows, setRows] = useState<LeagueStanding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('matches')
      .select('*')
      .eq('league_id', leagueId)
      .then(({ data }) => {
        if (!active) return
        const memberByUser = new Map(
          members.filter((m) => m.user_id).map((m) => [m.user_id!, m]),
        )
        const matchInputs = (data ?? [])
          .map((m) => {
            const p1 = m.player1_user_id ? memberByUser.get(m.player1_user_id) : undefined
            const p2 = m.player2_user_id ? memberByUser.get(m.player2_user_id) : undefined
            if (!p1 || !p2) return null
            return {
              player1_id: p1.id,
              player2_id: p2.id,
              player1_games: m.player1_games_won as number,
              player2_games: m.player2_games_won as number,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
        setRows(
          leagueStandings(
            members.map((m) => ({ id: m.id, name: m.name, seed_number: m.seed_number })),
            matchInputs,
          ),
        )
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [leagueId, members])

  if (loading) {
    return <div className="bg-white rounded-2xl shadow p-3 text-sm">Loading standings…</div>
  }

  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">Standings</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs">
            <th className="text-left px-3 py-1">#</th>
            <th className="text-left px-3 py-1">Name</th>
            <th className="text-right px-3 py-1">P</th>
            <th className="text-right px-3 py-1">W-L</th>
            <th className="text-right px-3 py-1">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5">{i + 1}</td>
              <td className="px-3 py-1.5 font-medium">{r.name}</td>
              <td className="px-3 py-1.5 text-right">{r.played}</td>
              <td className="px-3 py-1.5 text-right">{r.wins}-{r.losses}</td>
              <td className="px-3 py-1.5 text-right font-semibold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
