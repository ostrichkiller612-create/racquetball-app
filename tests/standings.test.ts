import { describe, it, expect } from 'vitest'
import { leagueStandings, type LeagueMatchInput, type LeagueMemberInput } from '../src/lib/scoring'

const members: LeagueMemberInput[] = [
  { id: 'a', name: 'Alice', seed_number: 1 },
  { id: 'b', name: 'Bob', seed_number: 2 },
  { id: 'c', name: 'Carol', seed_number: 3 },
]

describe('leagueStandings', () => {
  it('returns all members with 0 points if no matches', () => {
    const s = leagueStandings(members, [])
    expect(s).toHaveLength(3)
    expect(s.every((m) => m.points === 0 && m.played === 0)).toBe(true)
  })

  it('awards 3 to match winner regardless of game count', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'b', player1_games: 2, player2_games: 0 },
      { player1_id: 'a', player2_id: 'c', player1_games: 2, player2_games: 1 },
    ]
    const s = leagueStandings(members, matches)
    const alice = s.find((x) => x.id === 'a')!
    expect(alice.wins).toBe(2)
    expect(alice.points).toBe(6)
  })

  it('gives 1 to loser when they took at least one game', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'b', player1_games: 2, player2_games: 1 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.find((x) => x.id === 'b')!.points).toBe(1)
  })

  it('gives 0 to loser when swept', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'b', player1_games: 2, player2_games: 0 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.find((x) => x.id === 'b')!.points).toBe(0)
  })

  it('sorts standings by points desc, then by name', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'b', player2_id: 'a', player1_games: 2, player2_games: 0 },
      { player1_id: 'b', player2_id: 'c', player1_games: 2, player2_games: 0 },
      { player1_id: 'c', player2_id: 'a', player1_games: 2, player2_games: 1 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('ignores matches with unknown member ids', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'x-unknown', player1_games: 2, player2_games: 0 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.find((x) => x.id === 'a')!.points).toBe(0)
    expect(s.find((x) => x.id === 'a')!.played).toBe(0)
  })
})
