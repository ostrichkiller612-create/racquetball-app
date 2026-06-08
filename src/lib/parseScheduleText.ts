/**
 * Parses a league schedule text block into matchup rows.
 *
 * League sheets often arrange weeks in a multi-column grid: N date headers
 * across one row, then N matchups per row below. We process the text
 * line-by-line, treat lines that contain date(s) but no "vs" as header
 * rows that establish the current column→date mapping, and treat lines
 * with one-or-more "vs" matchups as data rows assigned to columns.
 *
 * Bare times (no AM/PM) are PM since league play is evenings.
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

const DATE_RE_GLOBAL = /(?:(\d{1,2})[-\s]+([A-Za-z]{3,9}))|(?:([A-Za-z]{3,9})[-\s]+(\d{1,2}))|(?:(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)/g
const ROW_RE_GLOBAL = /(\d{1,2})\s*(?:vs|v\.?|x)\s*(\d{1,2})(?:\s+(\d{1,2}:\d{2})(?:\s*(am|pm))?)?(?:\s+([A-Za-z0-9]+))?/gi

function pad(n: number): string { return String(n).padStart(2, '0') }
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
    // No AM/PM provided. League convention: bare 1..11 are PM.
    if (hour >= 1 && hour <= 11) hour += 12
  }
  return `${pad(hour)}:${pad(m)}`
}

function datesInLine(line: string, year: number): string[] {
  const isos: string[] = []
  DATE_RE_GLOBAL.lastIndex = 0
  for (const m of line.matchAll(DATE_RE_GLOBAL)) {
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
      isos.push(toIsoDate(y, month, day))
    }
  }
  return isos
}

type Matchup = { p1: number; p2: number; time: string | null; court: string | null }

function matchupsInLine(line: string): Matchup[] {
  const ms: Matchup[] = []
  ROW_RE_GLOBAL.lastIndex = 0
  for (const m of line.matchAll(ROW_RE_GLOBAL)) {
    const p1 = Number(m[1])
    const p2 = Number(m[2])
    if (!p1 || !p2 || p1 === p2 || p1 > 99 || p2 > 99) continue
    // Reject a "time" that starts with a digit we already consumed; if m[3]
    // exists it's the time portion (e.g. "5:00").
    const startTime = m[3] ? normalizeTime(m[3], m[4]) : null
    const courtRaw = m[5]
    const court = courtRaw && !/^(am|pm)$/i.test(courtRaw) ? courtRaw : null
    ms.push({ p1, p2, time: startTime, court })
  }
  return ms
}

export function parseScheduleText(text: string, year: number): ParsedScheduleRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const rows: ParsedScheduleRow[] = []

  // Running list of all dates seen so far (week numbering uses index here).
  const allDates: string[] = []
  // The dates for the CURRENT column-group (a header line establishes this).
  let columnDates: string[] = []
  // Maps each column-group date back to its absolute week index.
  let columnWeekStart = 0

  for (const line of lines) {
    const lineDates = datesInLine(line, year)
    const lineMatchups = matchupsInLine(line)

    // A "header line": contains dates and (effectively) no matchups.
    // We require matchups < dates to be confident this is a header row.
    if (lineDates.length > 0 && lineMatchups.length === 0) {
      columnDates = lineDates
      columnWeekStart = allDates.length
      for (const d of lineDates) allDates.push(d)
      continue
    }

    // Matchup row — assign each matchup to a column-date (by index).
    if (lineMatchups.length > 0 && columnDates.length > 0) {
      const N = Math.min(lineMatchups.length, columnDates.length)
      for (let i = 0; i < N; i++) {
        rows.push({
          week_number: columnWeekStart + i + 1,
          match_date: columnDates[i],
          start_time: lineMatchups[i].time,
          court: lineMatchups[i].court,
          player1_seed: lineMatchups[i].p1,
          player2_seed: lineMatchups[i].p2,
        })
      }
    }
  }

  return rows
}
