import type { LeagueMember } from './useLeagueMembers'

/**
 * Pairs OCR text from a photo of the gym's handwritten points board with
 * league members. For each member we look for their name on a line (full
 * name first, then last-name token, then first-name token) and take the
 * nearest number after the name on that line.
 *
 * Handwriting OCR is unreliable — this is a best-effort pre-fill. Members
 * with no confident hit are simply left out of the result.
 */
export function parseBoardPoints(
  text: string,
  members: LeagueMember[],
): Map<string, number> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const result = new Map<string, number>()
  const claimedLines = new Set<number>()

  // Pass 1: full-name matches (most specific). Pass 2: last name. Pass 3: first name.
  const passes: Array<(m: LeagueMember) => string | null> = [
    (m) => m.name.trim() || null,
    (m) => lastToken(m.name),
    (m) => firstToken(m.name),
  ]

  for (const getNeedle of passes) {
    for (const member of members) {
      if (result.has(member.id)) continue
      const needle = getNeedle(member)
      if (!needle || needle.length < 2) continue
      const needleNorm = needle.toLowerCase()

      for (let i = 0; i < lines.length; i++) {
        if (claimedLines.has(i)) continue
        const lineNorm = lines[i].toLowerCase()
        const at = lineNorm.indexOf(needleNorm)
        if (at === -1) continue

        const points = numberAfter(lines[i], at + needle.length)
        if (points === null) continue

        result.set(member.id, points)
        claimedLines.add(i)
        break
      }
    }
  }

  return result
}

function lastToken(name: string): string | null {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : null
}

function firstToken(name: string): string | null {
  const parts = name.trim().split(/\s+/)
  return parts[0] ?? null
}

/** First standalone number (0-999) appearing at or after `from` in the line. */
function numberAfter(line: string, from: number): number | null {
  const rest = line.slice(from)
  const m = rest.match(/(?:^|[\s:|\-–—=])(\d{1,3})(?:\b|$)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}
