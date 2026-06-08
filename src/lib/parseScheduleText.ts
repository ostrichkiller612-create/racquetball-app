/**
 * Parses text from a league schedule page (PDF page 2 or OCR'd photo) into
 * structured matchup rows.
 *
 * Recognizes:
 *   - Week date headers: "16-Jan", "Jan 16", "1/16", "01/16/26"
 *   - Matchup rows: "N vs M [HH:MM [AM|PM]] [court]"
 *
 * Bare times (no AM/PM) are treated as PM since league play is evenings.
 * Years for date strings without one come from the `year` argument.
 */
export type ParsedScheduleRow = {
  week_number: number
  match_date: string
  start_time: string | null
  court: string | null
  player1_seed: number
  player2_seed: number
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

const DATE_RE = /(?:(\d{1,2})[-\s]+([A-Za-z]{3,9}))|(?:([A-Za-z]{3,9})[-\s]+(\d{1,2}))|(?:(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)/g
const ROW_RE = /(\d{1,2})\s*(?:vs|v\.?|x)\s*(\d{1,2})(?:\s+(\d{1,2}:\d{2})(?:\s*(am|pm|AM|PM))?)?(?:\s+([A-Za-z0-9]+))?/g

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function normalizeTime(raw: string, ampm: string | undefined): string {
  const [h, m] = raw.split(':').map(Number)
  let hour = h
  const ap = ampm?.toLowerCase()
  if (ap === 'am') {
    if (hour === 12) hour = 0
  } else if (ap === 'pm') {
    if (hour < 12) hour += 12
  } else {
    // No AM/PM provided. League convention: bare 1..11 are PM. 12 stays 12 (noon).
    if (hour >= 1 && hour <= 11) hour += 12
  }
  return `${pad(hour)}:${pad(m)}`
}

type DateHit = { index: number; iso: string }

function findDates(text: string, year: number): DateHit[] {
  const hits: DateHit[] = []
  DATE_RE.lastIndex = 0
  for (const m of text.matchAll(DATE_RE)) {
    const idx = m.index ?? 0
    let day: number | undefined
    let month: number | undefined
    let y = year
    if (m[1] && m[2]) {
      day = Number(m[1])
      const mo = MONTHS[m[2].toLowerCase()]
      if (mo) month = mo
    } else if (m[3] && m[4]) {
      const mo = MONTHS[m[3].toLowerCase()]
      if (mo) month = mo
      day = Number(m[4])
    } else if (m[5] && m[6]) {
      month = Number(m[5])
      day = Number(m[6])
      if (m[7]) {
        const yy = Number(m[7])
        y = yy < 100 ? 2000 + yy : yy
      }
    }
    if (day && month && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      hits.push({ index: idx, iso: toIsoDate(y, month, day) })
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}

export function parseScheduleText(text: string, year: number): ParsedScheduleRow[] {
  const dates = findDates(text, year)
  if (dates.length === 0) return []

  const rows: ParsedScheduleRow[] = []
  ROW_RE.lastIndex = 0
  for (const m of text.matchAll(ROW_RE)) {
    const idx = m.index ?? 0
    const p1 = Number(m[1])
    const p2 = Number(m[2])
    if (!p1 || !p2 || p1 === p2 || p1 > 99 || p2 > 99) continue

    let date: DateHit | null = null
    let weekIndex = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i].index <= idx) {
        date = dates[i]
        weekIndex = i + 1
        break
      }
    }
    if (!date) continue

    const startTime = m[3] ? normalizeTime(m[3], m[4]) : null
    const court = m[5] && !/^(am|pm)$/i.test(m[5]) ? m[5] : null

    rows.push({
      week_number: weekIndex,
      match_date: date.iso,
      start_time: startTime,
      court,
      player1_seed: p1,
      player2_seed: p2,
    })
  }
  return rows
}
