/**
 * Parses text (from OCR or PDF) of a league roster sheet into {name, phone} rows.
 *
 * Strategy: scan the WHOLE text for phone-number patterns. For each match,
 * the name is the text between the previous phone (or start) and this phone,
 * with seed numbers and noise stripped.
 *
 * Accepts unicode dashes, optional area code, and bare 7- or 10-digit runs.
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
    const name = cleanName(between)

    lastEnd = (match.index ?? 0) + phoneRaw.length

    if (!name) continue
    if (name.length < 2 || !/[A-Za-z]/.test(name)) continue

    const key = name.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)
    if (phone) seenPhones.add(phone)

    rows.push({ name, phone })
  }

  return rows
}

// Words that show up as column headers or footers on league sheets and
// shouldn't leak into a name. Matches at word boundary, case-insensitive.
const HEADER_WORDS = [
  'Name', 'Phone', 'Player', 'Roster', 'Total', 'Points', 'Final', 'Ranking',
  'Week', 'Match', 'League', 'Court', 'Time', 'Date', 'Email', 'Standings',
  'Score', 'Wins', 'Losses', 'Address', 'PLEASE', 'REMEMBER', 'MARK', 'YOUR',
  'SCORES', 'SHEET', 'NOTE', 'NOTES',
]
const HEADER_RE = new RegExp(
  `^(?:${HEADER_WORDS.join('|')})\\b[:\\s]*`,
  'i',
)

function cleanName(raw: string): string {
  let s = raw.replace(/\r/g, '').split('\n').pop() ?? raw
  s = s.replace(/^\s*\d{1,3}[\s.):|\-–—]+/, '')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/[\s,.;:|\-–—]+$/g, '').trim()
  s = s.replace(/^[\s,.;:|\-–—]+/, '').trim()
  // Strip leading header words, possibly several in a row (e.g. "Phone Name Bob")
  let prev: string
  do {
    prev = s
    s = s.replace(HEADER_RE, '').trim()
  } while (s !== prev)
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
