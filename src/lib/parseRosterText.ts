/**
 * Parses roster text (from PDF/OCR) into {name, phone} rows.
 *
 * Scans the whole text for phone-number patterns. For each match, the name
 * is the text between the previous phone and this phone. The "name" can
 * appear on the same line as the phone OR on the line just above it
 * (some league sheets stack name-then-seed-and-phone). We try the last
 * line first, fall back to the previous non-trivial line if needed.
 */
export type ParsedRosterEntry = {
  name: string
  phone: string | null
}

const SEP = `[\\s\\-–—‐‑‒.·_]*`
const PHONE_RE = new RegExp(
  `(?:\\(?\\d{3}\\)?${SEP})?\\d{3}${SEP}\\d{4}`,
  'g',
)

const HEADER_WORDS = [
  'Name', 'Phone', 'Player', 'Roster', 'Total', 'Points', 'Final', 'Ranking',
  'Week', 'Match', 'League', 'Court', 'Time', 'Date', 'Email', 'Standings',
  'Score', 'Wins', 'Losses', 'Address', 'PLEASE', 'REMEMBER', 'MARK', 'YOUR',
  'SCORES', 'SHEET', 'NOTE', 'NOTES', 'THURSDAY', 'WEDNESDAY', 'TUESDAY',
  'MONDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
]
const HEADER_RE = new RegExp(`^(?:${HEADER_WORDS.join('|')})\\b[:\\s]*`, 'i')

export function parseRosterText(text: string): ParsedRosterEntry[] {
  const rows: ParsedRosterEntry[] = []
  const seenNames = new Set<string>()
  const seenPhones = new Set<string>()

  let lastEnd = 0
  for (const match of text.matchAll(PHONE_RE)) {
    const phoneRaw = match[0]
    const phone = normalizePhone(phoneRaw)
    const digitCount = phoneRaw.replace(/\D/g, '').length
    if (digitCount !== 7 && digitCount !== 10) {
      lastEnd = (match.index ?? 0) + phoneRaw.length
      continue
    }
    if (phone && seenPhones.has(phone)) {
      lastEnd = (match.index ?? 0) + phoneRaw.length
      continue
    }

    const between = text.slice(lastEnd, match.index ?? 0)
    const name = nameFromChunk(between)

    lastEnd = (match.index ?? 0) + phoneRaw.length

    if (!name) continue

    const key = name.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)
    if (phone) seenPhones.add(phone)

    rows.push({ name, phone })
  }

  return rows
}

/**
 * Try the last line for a name. If it's empty after cleaning (e.g. just a
 * seed number with no name), fall back to the previous lines until we find
 * something that looks like a name.
 */
function nameFromChunk(raw: string): string {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  // Walk backwards so we try the most recent line first.
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = cleanName(lines[i])
    if (isValidName(candidate)) return candidate
  }
  return ''
}

function isValidName(s: string): boolean {
  if (s.length < 2) return false
  if (!/[A-Za-z]/.test(s)) return false
  // Reject lines that are only digits + punctuation (a seed marker like "10.")
  if (/^[\d\s.):|\-–—]+$/.test(s)) return false
  return true
}

function cleanName(s: string): string {
  s = s.replace(/^\s*\d{1,3}[\s.):|\-–—]+/, '')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/[\s,.;:|\-–—]+$/g, '').trim()
  s = s.replace(/^[\s,.;:|\-–—]+/, '').trim()
  let prev: string
  do {
    prev = s
    s = s.replace(HEADER_RE, '').trim()
  } while (s !== prev)
  // Strip a trailing 0/1/2-digit count that some sheets include (a points cell)
  s = s.replace(/\s+\d{1,3}$/, '').trim()
  return s
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return raw.trim()
}
