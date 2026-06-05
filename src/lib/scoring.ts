export type Points = [number, number]

export function matchPoints(p1Games: number, p2Games: number): Points {
  if (p1Games === p2Games) {
    throw new Error('Ties are not allowed in racquetball matches')
  }
  const p1Won = p1Games > p2Games
  return p1Won ? [3, p2Games > 0 ? 1 : 0] : [p1Games > 0 ? 1 : 0, 3]
}

export type MatchSummary = {
  youWon: boolean
  opponentId: string
  opponentName: string
  yourGames: number
  theirGames: number
}

export type Record = { wins: number; losses: number; played: number }

export type HeadToHead = {
  overall: Record
  perOpponent: Array<Record & { opponentId: string; opponentName: string }>
}

export function summarizeHeadToHead(matches: MatchSummary[], _userId: string): HeadToHead {
  const overall: Record = { wins: 0, losses: 0, played: 0 }
  const byOpponent = new Map<string, Record & { opponentName: string }>()

  for (const m of matches) {
    overall.played += 1
    if (m.youWon) overall.wins += 1
    else overall.losses += 1

    const existing = byOpponent.get(m.opponentId) ?? {
      opponentName: m.opponentName,
      wins: 0,
      losses: 0,
      played: 0,
    }
    existing.played += 1
    if (m.youWon) existing.wins += 1
    else existing.losses += 1
    byOpponent.set(m.opponentId, existing)
  }

  const perOpponent = Array.from(byOpponent.entries())
    .map(([opponentId, r]) => ({ opponentId, ...r }))
    .sort((a, b) => b.played - a.played || a.opponentName.localeCompare(b.opponentName))

  return { overall, perOpponent }
}

export type LeagueMemberInput = {
  id: string
  name: string
  seed_number: number
}

export type LeagueMatchInput = {
  player1_id: string
  player2_id: string
  player1_games: number
  player2_games: number
}

export type LeagueStanding = {
  id: string
  name: string
  seed_number: number
  played: number
  wins: number
  losses: number
  points: number
}

export function leagueStandings(
  members: LeagueMemberInput[],
  matches: LeagueMatchInput[],
): LeagueStanding[] {
  const byId = new Map<string, LeagueStanding>()
  for (const m of members) {
    byId.set(m.id, {
      id: m.id,
      name: m.name,
      seed_number: m.seed_number,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
    })
  }

  for (const match of matches) {
    const p1 = byId.get(match.player1_id)
    const p2 = byId.get(match.player2_id)
    if (!p1 || !p2) continue
    if (match.player1_games === match.player2_games) continue

    const [pts1, pts2] = matchPoints(match.player1_games, match.player2_games)
    p1.played += 1
    p2.played += 1
    p1.points += pts1
    p2.points += pts2
    if (match.player1_games > match.player2_games) {
      p1.wins += 1
      p2.losses += 1
    } else {
      p2.wins += 1
      p1.losses += 1
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  )
}
