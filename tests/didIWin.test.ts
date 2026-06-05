import { describe, it, expect } from 'vitest'
import { didIWin } from '../src/lib/scoring'
import type { Match } from '../src/matches/useMatches'

const me = 'user-me'

function makeSingles(p1: string, p2: string, p1Games: number, p2Games: number): Match {
  return {
    id: 'm', league_id: null, match_date: '2026-06-05',
    match_type: 'singles',
    player1_user_id: p1, player1_contact_id: null,
    player2_user_id: p2, player2_contact_id: null,
    player3_user_id: null, player3_contact_id: null,
    player4_user_id: null, player4_contact_id: null,
    player1_games_won: p1Games, player2_games_won: p2Games,
    winner_position: null, notes: null,
    entered_by: 'me', created_at: '',
  }
}

function makeCutthroat(positions: [string, string, string], winnerPos: 1 | 2 | 3): Match {
  return {
    id: 'm', league_id: null, match_date: '2026-06-05',
    match_type: 'cutthroat',
    player1_user_id: positions[0], player1_contact_id: null,
    player2_user_id: positions[1], player2_contact_id: null,
    player3_user_id: positions[2], player3_contact_id: null,
    player4_user_id: null, player4_contact_id: null,
    player1_games_won: 0, player2_games_won: 0,
    winner_position: winnerPos, notes: null,
    entered_by: 'me', created_at: '',
  }
}

function makeDoubles(positions: [string, string, string, string], winningTeam: 1 | 2): Match {
  return {
    id: 'm', league_id: null, match_date: '2026-06-05',
    match_type: 'doubles',
    player1_user_id: positions[0], player1_contact_id: null,
    player2_user_id: positions[1], player2_contact_id: null,
    player3_user_id: positions[2], player3_contact_id: null,
    player4_user_id: positions[3], player4_contact_id: null,
    player1_games_won: 0, player2_games_won: 0,
    winner_position: winningTeam, notes: null,
    entered_by: 'me', created_at: '',
  }
}

describe('didIWin', () => {
  describe('singles', () => {
    it('returns true when I am player1 and won', () => {
      expect(didIWin(makeSingles(me, 'opp', 2, 0), me)).toBe(true)
    })
    it('returns true when I am player2 and won', () => {
      expect(didIWin(makeSingles('opp', me, 0, 2), me)).toBe(true)
    })
    it('returns false when I lost', () => {
      expect(didIWin(makeSingles(me, 'opp', 1, 2), me)).toBe(false)
    })
    it('returns false when I was not in the match', () => {
      expect(didIWin(makeSingles('a', 'b', 2, 0), me)).toBe(false)
    })
  })

  describe('cutthroat', () => {
    it('returns true when I am position 1 and won', () => {
      expect(didIWin(makeCutthroat([me, 'b', 'c'], 1), me)).toBe(true)
    })
    it('returns true when I am position 2 and won', () => {
      expect(didIWin(makeCutthroat(['a', me, 'c'], 2), me)).toBe(true)
    })
    it('returns true when I am position 3 and won', () => {
      expect(didIWin(makeCutthroat(['a', 'b', me], 3), me)).toBe(true)
    })
    it('returns false when someone else won', () => {
      expect(didIWin(makeCutthroat([me, 'b', 'c'], 2), me)).toBe(false)
    })
    it('returns false when I was not in the match', () => {
      expect(didIWin(makeCutthroat(['a', 'b', 'c'], 1), me)).toBe(false)
    })
  })

  describe('doubles', () => {
    it('returns true when I am on the winning team (slot 1)', () => {
      expect(didIWin(makeDoubles([me, 'partner', 'opp1', 'opp2'], 1), me)).toBe(true)
    })
    it('returns true when I am on the winning team (slot 2)', () => {
      expect(didIWin(makeDoubles(['partner', me, 'opp1', 'opp2'], 1), me)).toBe(true)
    })
    it('returns true when I am on team 2 and team 2 won', () => {
      expect(didIWin(makeDoubles(['a', 'b', me, 'partner'], 2), me)).toBe(true)
    })
    it('returns false when I am on the losing team', () => {
      expect(didIWin(makeDoubles([me, 'partner', 'opp1', 'opp2'], 2), me)).toBe(false)
    })
    it('returns false when I was not in the match', () => {
      expect(didIWin(makeDoubles(['a', 'b', 'c', 'd'], 1), me)).toBe(false)
    })
  })
})
