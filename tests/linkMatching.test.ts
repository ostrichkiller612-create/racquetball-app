import { describe, it, expect } from 'vitest'
import { proposeLinks } from '../src/leagues/linkMatching'
import type { Match } from '../src/matches/useMatches'
import type { LeagueMember } from '../src/leagues/useLeagueMembers'
import type { ScheduleRow } from '../src/leagues/useLeagueSchedule'

const jimUser = 'user-jim'

function member(id: string, seed: number, name: string, userId: string | null): LeagueMember {
  return { id, league_id: 'L1', user_id: userId, seed_number: seed, name, phone: null, email: null, role: 'member' }
}

function schedRow(id: string, date: string, p1: string, p2: string, matchId: string | null = null): ScheduleRow {
  return {
    id, league_id: 'L1', week_number: 1, match_date: date,
    start_time: null, court: null,
    player1_member_id: p1, player2_member_id: p2,
    match_id: matchId, notes: null,
  }
}

function singlesMatch(id: string, date: string, oppContactId: string, jimGames: number, oppGames: number): Match {
  return {
    id, league_id: null, match_date: date, match_type: 'singles',
    player1_user_id: jimUser, player1_contact_id: null,
    player2_user_id: null, player2_contact_id: oppContactId,
    player3_user_id: null, player3_contact_id: null,
    player4_user_id: null, player4_contact_id: null,
    player1_games_won: jimGames, player2_games_won: oppGames,
    winner_position: null, notes: null, entered_by: jimUser, created_at: '',
  }
}

const members = [
  member('M1', 1, 'James Herrington', jimUser),
  member('M2', 2, 'Kaleb Zedeck', null),
  member('M3', 3, 'Andrew Duwe', null),
]

const contactNames = new Map([
  ['c-kaleb', 'Kaleb Zedeck'],
  ['c-duwe', 'Andrew Duwe'],
])

describe('proposeLinks', () => {
  it('pairs by contact name within the date window', () => {
    const schedule = [schedRow('S1', '2026-05-14', 'M1', 'M2')]
    const matches = [singlesMatch('X1', '2026-05-14', 'c-kaleb', 2, 0)]
    const links = proposeLinks(schedule, matches, members, contactNames)
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      scheduleId: 'S1', matchId: 'X1',
      player1Games: 2, player2Games: 0,
    })
  })

  it('orients games when the schedule lists players in the opposite order', () => {
    // Schedule says Kaleb (M2) is player1, Jim (M1) is player2.
    const schedule = [schedRow('S1', '2026-05-14', 'M2', 'M1')]
    const matches = [singlesMatch('X1', '2026-05-14', 'c-kaleb', 2, 1)]
    const links = proposeLinks(schedule, matches, members, contactNames)
    expect(links).toHaveLength(1)
    // Jim won 2-1, but schedule player1 is Kaleb -> 1-2 from Kaleb's view.
    expect(links[0].player1Games).toBe(1)
    expect(links[0].player2Games).toBe(2)
  })

  it('respects the ±3 day window', () => {
    const schedule = [schedRow('S1', '2026-05-14', 'M1', 'M2')]
    const matches = [singlesMatch('X1', '2026-05-18', 'c-kaleb', 2, 0)] // 4 days out
    expect(proposeLinks(schedule, matches, members, contactNames)).toHaveLength(0)
  })

  it('prefers the closest date when two rows could claim one match', () => {
    const schedule = [
      schedRow('S1', '2026-05-14', 'M1', 'M2'),
      schedRow('S2', '2026-05-16', 'M1', 'M2'),
    ]
    const matches = [singlesMatch('X1', '2026-05-16', 'c-kaleb', 2, 0)]
    const links = proposeLinks(schedule, matches, members, contactNames)
    expect(links).toHaveLength(1)
    expect(links[0].scheduleId).toBe('S2')
  })

  it('never double-assigns a match to two rows', () => {
    const schedule = [
      schedRow('S1', '2026-05-14', 'M1', 'M2'),
      schedRow('S2', '2026-05-15', 'M1', 'M2'),
    ]
    const matches = [
      singlesMatch('X1', '2026-05-14', 'c-kaleb', 2, 0),
      singlesMatch('X2', '2026-05-15', 'c-kaleb', 1, 2),
    ]
    const links = proposeLinks(schedule, matches, members, contactNames)
    expect(links).toHaveLength(2)
    const matchIds = links.map((l) => l.matchId).sort()
    expect(matchIds).toEqual(['X1', 'X2'])
  })

  it('skips rows already linked', () => {
    const schedule = [schedRow('S1', '2026-05-14', 'M1', 'M2', 'existing-match')]
    const matches = [singlesMatch('X1', '2026-05-14', 'c-kaleb', 2, 0)]
    expect(proposeLinks(schedule, matches, members, contactNames)).toHaveLength(0)
  })

  it('skips matches already linked to another row', () => {
    const schedule = [
      schedRow('S1', '2026-05-14', 'M1', 'M2', 'X1'),
      schedRow('S2', '2026-05-14', 'M1', 'M3'),
    ]
    const matches = [singlesMatch('X1', '2026-05-14', 'c-duwe', 2, 0)]
    // X1 already linked to S1, so S2 finds nothing.
    expect(proposeLinks(schedule, matches, members, contactNames)).toHaveLength(0)
  })

  it('ignores non-singles matches', () => {
    const schedule = [schedRow('S1', '2026-05-14', 'M1', 'M2')]
    const cut: Match = {
      ...singlesMatch('X1', '2026-05-14', 'c-kaleb', 0, 0),
      match_type: 'cutthroat', winner_position: 1,
      player3_user_id: null, player3_contact_id: 'c-duwe',
    }
    expect(proposeLinks(schedule, [cut], members, contactNames)).toHaveLength(0)
  })

  it('does not pair when the opponent name differs', () => {
    const schedule = [schedRow('S1', '2026-05-14', 'M1', 'M3')] // vs Andrew Duwe
    const matches = [singlesMatch('X1', '2026-05-14', 'c-kaleb', 2, 0)] // played Kaleb
    expect(proposeLinks(schedule, matches, members, contactNames)).toHaveLength(0)
  })
})
