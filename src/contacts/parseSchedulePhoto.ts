/**
 * Parses raw OCR text from a photo of a league schedule sheet
 * into a list of {name, phone} rows.
 *
 * Expected input shape per line (rough):
 *   "1  James Herrington  462-0214"
 *   "2 Bill Boulden 510-4811"
 *   "8 Jonelle Gordon  347-805-3588"
 *
 * OCR is noisy — this is intentionally forgiving:
 *   - Strips a leading seed number (1-99) when present
 *   - Tolerates whitespace variation, mixed dashes/spaces in phone numbers
 *   - Skips lines without a phone-like pattern
 */
export type ParsedContact = {
  name: string
  phone: string | null
}

const PHONE_PATTERN = /(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]\d{4}/

export function parseSchedulePhoto(text: string): ParsedContact[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const rows: ParsedContact[] = []
  const seenNames = new Set<string>()

  for (const rawLine of lines) {
    const phoneMatch = rawLine.match(PHONE_PATTERN)
    if (!phoneMatch) continue

    const phone = normalizePhone(phoneMatch[0])
    const beforePhone = rawLine.slice(0, phoneMatch.index ?? 0).trim()

    // Strip a leading seed number like "1" or "10" if present.
    const name = beforePhone
      .replace(/^\d{1,2}[\s).:|-]+/, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!name) continue
    // Reject obvious garbage names — at least 2 chars, must contain a letter.
    if (name.length < 2 || !/[A-Za-z]/.test(name)) continue

    const key = name.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)

    rows.push({ name, phone })
  }

  return rows
}

function normalizePhone(raw: string): string {
  // Collapse to digits then re-format as XXX-XXX-XXXX or XXX-XXXX.
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return raw.trim()
}
