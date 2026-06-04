import { describe, it, expect } from 'vitest'
import { matchPoints, summarizeHeadToHead, type MatchSummary } from '../src/lib/scoring'

describe('matchPoints', () => {
  it('returns [3, 0] when player1 sweeps 2-0', () => {
    expect(matchPoints(2, 0)).toEqual([3, 0])
  })

  it('returns [3, 1] when player1 wins 2-1', () => {
    expect(matchPoints(2, 1)).toEqual([3, 1])
  })

  it('returns [0, 3] when player1 is swept 0-2', () => {
    expect(matchPoints(0, 2)).toEqual([0, 3])
  })

  it('returns [1, 3] when player1 loses 1-2', () => {
    expect(matchPoints(1, 2)).toEqual([1, 3])
  })

  it('throws on a tie', () => {
    expect(() => matchPoints(1, 1)).toThrow(/tie|draw/i)
  })
})

describe('summarizeHeadToHead', () => {
  const me = 'user-me'
  const bob = 'opponent-bob'
  const sue = 'opponent-sue'

  const matches: MatchSummary[] = [
    { youWon: true, opponentId: bob, opponentName: 'Bob', yourGames: 2, theirGames: 0 },
    { youWon: true, opponentId: bob, opponentName: 'Bob', yourGames: 2, theirGames: 1 },
    { youWon: false, opponentId: bob, opponentName: 'Bob', yourGames: 1, theirGames: 2 },
    { youWon: true, opponentId: sue, opponentName: 'Sue', yourGames: 2, theirGames: 0 },
  ]

  it('returns overall W-L', () => {
    const { overall } = summarizeHeadToHead(matches, me)
    expect(overall).toEqual({ wins: 3, losses: 1, played: 4 })
  })

  it('returns per-opponent record', () => {
    const { perOpponent } = summarizeHeadToHead(matches, me)
    expect(perOpponent).toEqual([
      { opponentId: bob, opponentName: 'Bob', wins: 2, losses: 1, played: 3 },
      { opponentId: sue, opponentName: 'Sue', wins: 1, losses: 0, played: 1 },
    ])
  })

  it('sorts opponents by most played', () => {
    const { perOpponent } = summarizeHeadToHead(matches, me)
    expect(perOpponent[0].opponentName).toBe('Bob')
  })

  it('handles empty input', () => {
    const { overall, perOpponent } = summarizeHeadToHead([], me)
    expect(overall).toEqual({ wins: 0, losses: 0, played: 0 })
    expect(perOpponent).toEqual([])
  })
})
