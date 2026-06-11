import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { leagueStandings, type LeagueStanding, type LeagueMatchInput } from '../lib/scoring'
import type { LeagueMember } from './useLeagueMembers'

type MatchRecord = {
  id: string
  player1_user_id: string | null
  player2_user_id: string | null
  player1_games_won: number
  player2_games_won: number
}

type LinkRecord = {
  match_id: string | null
  player1_member_id: string | null
  player2_member_id: string | null
}

export function Standings({ leagueId, members }: { leagueId: string; members: LeagueMember[] }) {
  const [rows, setRows] = useState<LeagueStanding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      const [{ data: matches }, { data: links }] = await Promise.all([
        supabase.from('matches').select('*').eq('league_id', leagueId),
        supabase
          .from('league_schedule')
          .select('match_id, player1_member_id, player2_member_id')
          .eq('league_id', leagueId)
          .not('match_id', 'is', null),
      ])
      if (!active) return

      const matchById = new Map(
        ((matches ?? []) as MatchRecord[]).map((m) => [m.id, m]),
      )
      const memberById = new Map(members.map((m) => [m.id, m]))
      const memberByUser = new Map(
        members.filter((m) => m.user_id).map((m) => [m.user_id!, m]),
      )

      const inputs: LeagueMatchInput[] = []
      const counted = new Set<string>()

      // 1. Schedule-linked matches: attribution comes from the schedule row's
      //    members, which works even when an opponent is contact-based.
      for (const link of (links ?? []) as LinkRecord[]) {
        if (!link.match_id || !link.player1_member_id || !link.player2_member_id) continue
        const match = matchById.get(link.match_id)
        if (!match || counted.has(match.id)) continue
        const m1 = memberById.get(link.player1_member_id)
        const m2 = memberById.get(link.player2_member_id)
        if (!m1 || !m2) continue

        // Orient: which schedule member is the match's player1?
        let p1Games: number
        let p2Games: number
        if (match.player1_user_id && m1.user_id === match.player1_user_id) {
          p1Games = match.player1_games_won
          p2Games = match.player2_games_won
        } else if (match.player1_user_id && m2.user_id === match.player1_user_id) {
          p1Games = match.player2_games_won
          p2Games = match.player1_games_won
        } else if (match.player2_user_id && m1.user_id === match.player2_user_id) {
          p1Games = match.player2_games_won
          p2Games = match.player1_games_won
        } else if (match.player2_user_id && m2.user_id === match.player2_user_id) {
          p1Games = match.player1_games_won
          p2Games = match.player2_games_won
        } else {
          continue // can't determine orientation — don't guess
        }

        counted.add(match.id)
        inputs.push({
          player1_id: m1.id,
          player2_id: m2.id,
          player1_games: p1Games,
          player2_games: p2Games,
        })
      }

      // 2. Remaining league matches where both players have user accounts.
      for (const m of (matches ?? []) as MatchRecord[]) {
        if (counted.has(m.id)) continue
        const p1 = m.player1_user_id ? memberByUser.get(m.player1_user_id) : undefined
        const p2 = m.player2_user_id ? memberByUser.get(m.player2_user_id) : undefined
        if (!p1 || !p2) continue
        counted.add(m.id)
        inputs.push({
          player1_id: p1.id,
          player2_id: p2.id,
          player1_games: m.player1_games_won,
          player2_games: m.player2_games_won,
        })
      }

      setRows(
        leagueStandings(
          members.map((m) => ({ id: m.id, name: m.name, seed_number: m.seed_number })),
          inputs,
        ),
      )
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [leagueId, members])

  if (loading) {
    return <div className="bg-white rounded-2xl shadow p-3 text-sm">Loading standings…</div>
  }

  // When the league has official board totals, they take over the ranking;
  // the app-computed points show small for comparison.
  const boardById = new Map(
    members
      .filter((m) => m.board_points != null)
      .map((m) => [m.id, m.board_points as number]),
  )
  const hasBoard = boardById.size > 0
  const displayRows = hasBoard
    ? [...rows].sort((a, b) => {
        const ba = boardById.get(a.id)
        const bb = boardById.get(b.id)
        if (ba != null && bb != null && bb !== ba) return bb - ba
        if (ba != null && bb == null) return -1
        if (ba == null && bb != null) return 1
        return b.points - a.points || a.name.localeCompare(b.name)
      })
    : rows
  const boardUpdated = members
    .map((m) => m.board_updated_at)
    .filter((x): x is string => !!x)
    .sort()
    .pop()

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
          {displayRows.map((r, i) => {
            const board = boardById.get(r.id)
            return (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium">{r.name}</td>
                <td className="px-3 py-1.5 text-right">{r.played}</td>
                <td className="px-3 py-1.5 text-right">{r.wins}-{r.losses}</td>
                <td className="px-3 py-1.5 text-right font-semibold">
                  {hasBoard ? (
                    <>
                      {board ?? '—'}
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        app {r.points}
                      </span>
                    </>
                  ) : (
                    r.points
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {hasBoard && boardUpdated && (
        <div className="px-4 py-1.5 text-xs text-slate-400 border-t">
          Board updated {boardUpdated.slice(0, 10)}
        </div>
      )}
    </div>
  )
}
