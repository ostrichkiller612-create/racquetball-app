import type { Match } from '../matches/useMatches'
import type { LeagueMember } from './useLeagueMembers'
import type { ScheduleRow } from './useLeagueSchedule'

export type ContactNameLookup = Map<string, string> // contact_id -> name

export type ProposedLink = {
  scheduleId: string
  matchId: string
  // For display in the preview list:
  weekNumber: number
  scheduleDate: string
  matchDate: string
  player1Name: string
  player2Name: string
  // Score oriented to the schedule's player1:
  player1Games: number
  player2Games: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / DAY_MS
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Does this league member correspond to the given match player slot?
 * True when the member's user account played, or the player slot is a
 * contact whose name equals the member's name.
 */
function memberMatchesSlot(
  member: LeagueMember,
  slotUserId: string | null,
  slotContactId: string | null,
  contactNames: ContactNameLookup,
): boolean {
  if (slotUserId && member.user_id === slotUserId) return true
  if (slotContactId) {
    const contactName = contactNames.get(slotContactId)
    if (contactName && norm(contactName) === norm(member.name)) return true
  }
  return false
}

/**
 * Pair unlinked schedule rows with singles matches.
 *
 * A match pairs with a row when both scheduled members are identifiable in
 * the match's two player slots (either order) and the dates are within
 * `maxDays`. Each match links to at most one row; when several rows could
 * claim the same match, the closest date wins.
 */
export function proposeLinks(
  schedule: ScheduleRow[],
  matches: Match[],
  members: LeagueMember[],
  contactNames: ContactNameLookup,
  maxDays = 3,
): ProposedLink[] {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const linkedMatchIds = new Set(
    schedule.map((s) => s.match_id).filter((x): x is string => x !== null),
  )

  // Gather every candidate (row, match) pairing with its date distance.
  type Candidate = { row: ScheduleRow; match: Match; dist: number; flipped: boolean }
  const candidates: Candidate[] = []

  for (const row of schedule) {
    if (row.match_id) continue
    if (!row.player1_member_id || !row.player2_member_id) continue
    const m1 = memberById.get(row.player1_member_id)
    const m2 = memberById.get(row.player2_member_id)
    if (!m1 || !m2) continue

    for (const match of matches) {
      if (match.match_type !== 'singles') continue
      if (linkedMatchIds.has(match.id)) continue
      const dist = daysBetween(row.match_date, match.match_date)
      if (dist > maxDays) continue

      const straight =
        memberMatchesSlot(m1, match.player1_user_id, match.player1_contact_id, contactNames) &&
        memberMatchesSlot(m2, match.player2_user_id, match.player2_contact_id, contactNames)
      const flipped =
        !straight &&
        memberMatchesSlot(m1, match.player2_user_id, match.player2_contact_id, contactNames) &&
        memberMatchesSlot(m2, match.player1_user_id, match.player1_contact_id, contactNames)

      if (straight || flipped) {
        candidates.push({ row, match, dist, flipped })
      }
    }
  }

  // Greedy assignment: closest date first, one match per row, one row per match.
  candidates.sort((a, b) => a.dist - b.dist)
  const usedRows = new Set<string>()
  const usedMatches = new Set<string>()
  const links: ProposedLink[] = []

  for (const c of candidates) {
    if (usedRows.has(c.row.id) || usedMatches.has(c.match.id)) continue
    usedRows.add(c.row.id)
    usedMatches.add(c.match.id)

    const m1 = memberById.get(c.row.player1_member_id!)!
    const m2 = memberById.get(c.row.player2_member_id!)!
    links.push({
      scheduleId: c.row.id,
      matchId: c.match.id,
      weekNumber: c.row.week_number,
      scheduleDate: c.row.match_date,
      matchDate: c.match.match_date,
      player1Name: m1.name,
      player2Name: m2.name,
      player1Games: c.flipped ? c.match.player2_games_won : c.match.player1_games_won,
      player2Games: c.flipped ? c.match.player1_games_won : c.match.player2_games_won,
    })
  }

  return links
}
