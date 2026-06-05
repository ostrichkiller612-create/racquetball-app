/**
 * Parses raw OCR text from a photo of a league schedule sheet
 * into a list of {name, phone} rows.
 *
 * Strategy: scan the WHOLE text for phone-number patterns (not just per-line —
 * Tesseract often jams rows together or splits them oddly). For each phone
 * match, the name is whatever text sits between the previous phone (or start)
 * and this phone, with seed numbers and noise stripped.
 *
 * The phone pattern accepts dashes/spaces/dots/unicode-dashes between digit
 * groups, and area-code-prefix is optional. We also accept a run of 10 or 7
 * digits with no separator at all.
 */
export type ParsedContact = {
  name: string
  phone: string | null
}

// Any common separator OCR might emit between digit groups (ASCII hyphen,
// en-dash, em-dash, hyphen-minus, dot, middle-dot, underscore, whitespace,
// or nothing).
const SEP = `[\\s\\-–—‐‑‒.·_]*`

// Match either: (XXX) XXX-XXXX style OR XXX-XXX-XXXX OR XXX-XXXX (7 digits)
const PHONE_RE = new RegExp(
  `(?:\\(?\\d{3}\\)?${SEP})?\\d{3}${SEP}\\d{4}`,
  'g',
)

export function parseSchedulePhoto(text: string): ParsedContact[] {
  const rows: ParsedContact[] = []
  const seenNames = new Set<string>()
  const seenPhones = new Set<string>()

  let lastEnd = 0
  for (const match of text.matchAll(PHONE_RE)) {
    const phoneRaw = match[0]
    const phone = normalizePhone(phoneRaw)

    // Skip phones with too few or too many digits to be a real US number
    const digitCount = phoneRaw.replace(/\D/g, '').length
    if (digitCount !== 7 && digitCount !== 10) {
      lastEnd = (match.index ?? 0) + phoneRaw.length
      continue
    }

    // Skip if we've already seen this exact phone (duplicate scan or repeat)
    if (phone && seenPhones.has(phone)) {
      lastEnd = (match.index ?? 0) + phoneRaw.length
      continue
    }

    // Pull the slice of text between the last phone (or start) and this phone
    // — that's where the name lives.
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

function cleanName(raw: string): string {
  // Take the last "line" of the chunk (helps when OCR jams junk in front).
  let s = raw.replace(/\r/g, '').split('\n').pop() ?? raw

  // Drop a leading seed number like "1", "10.", "10)", "10:", "10 -"
  s = s.replace(/^\s*\d{1,3}[\s.):|\-–—]+/, '')

  // Collapse runs of whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // Strip trailing punctuation
  s = s.replace(/[\s,.;:|\-–—]+$/g, '').trim()

  // Strip leading punctuation
  s = s.replace(/^[\s,.;:|\-–—]+/, '').trim()

  // If the chunk has multiple "words" but starts with a long header word
  // like "Name" or "Phone" (common in printed table headers), drop it.
  s = s.replace(/^(Name|Phone|Player|Roster)\b[:\s]*/i, '').trim()

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
