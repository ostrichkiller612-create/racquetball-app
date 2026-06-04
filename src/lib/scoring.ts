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
