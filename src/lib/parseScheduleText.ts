/**
 * Parses a league schedule text block into matchup rows.
 *
 * League sheets arrange weeks in a multi-column grid: N date headers across
 * one row, then N matchups per row below. We process line-by-line: a line
 * with dates and no matchups establishes the column→date mapping; a line
 * with matchups assigns them to columns by order.
 *
 * Two PDF quirks handled explicitly:
 * - "2 VS 5:00 2" — the opponent number is missing because the PDF split
 *   the cell. The time must NOT be misread as the opponent. The slot is
 *   kept as incomplete.
 * - A following line of bare numbers ("7   9") carries the dropped
 *   opponents, in column order — they're zipped back into the incomplete
 *   slots from the previous line.
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

// Only real month words — a generic [A-Za-z]+ here would let "Court 21"
// consume the "21" of "21-May" during the global scan.
const MONTH_WORD =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const DATE_RE_GLOBAL = new RegExp(
  `(?:(\\d{1,2})[-\\s]+(${MONTH_WORD})\\b)|(?:\\b(${MONTH_WORD})[-\\s]+(\\d{1,2}))|(?:(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?)`,
  'gi',
)

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

type Slot = {
  p1: number
  p2: number | null // null = cell was split; opponent may be on the next line
  time: string | null
  court: string | null
}

/**
 * Extract matchup slots from a line, left to right. A slot is "N vs [M]"
 * with optional time and court. The opponent capture refuses to consume the
 * hour of a following time ("2 VS 5:00" never yields opponent 5).
 */
function slotsInLine(line: string): Slot[] {
  const slots: Slot[] = []
  const vsRe = /(\d{1,2})\s*(?:vs|v\.?|x)\b/gi
  let m: RegExpExecArray | null
  while ((m = vsRe.exec(line))) {
    const p1 = Number(m[1])
    if (!p1 || p1 > 99) continue

    let rest = line.slice(vsRe.lastIndex)
    let p2: number | null = null
    let time: string | null = null
    let court: string | null = null

    // Opponent: digits NOT followed by ':' or more digits (that'd be a time/3-digit junk)
    const p2m = rest.match(/^\s*(\d{1,2})(?![\d:])/)
    if (p2m) {
      const candidate = Number(p2m[1])
      if (candidate >= 1 && candidate <= 99 && candidate !== p1) {
        p2 = candidate
        rest = rest.slice(p2m[0].length)
      } else {
        continue // "3 vs 3" style garbage — skip the slot entirely
      }
    }

    const tm = rest.match(/^\s*(\d{1,2}:\d{2})/)
    if (tm) {
      rest = rest.slice(tm[0].length)
      const am = rest.match(/^\s*(am|pm)/i)
      let ampm: string | undefined
      if (am) {
        ampm = am[1]
        rest = rest.slice(am[0].length)
      }
      time = normalizeTime(tm[1], ampm)
    }

    const cm = rest.match(/^\s+(\d{1,2}|[A-Za-z]\d?)\b/)
    if (cm) court = cm[1]

    slots.push({ p1, p2, time, court })
  }
  return slots
}

type PendingSlot = {
  p1: number
  time: string | null
  court: string | null
  week_number: number
  match_date: string
}

export function parseScheduleText(text: string, year: number): ParsedScheduleRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const rows: ParsedScheduleRow[] = []

  const allDates: string[] = []
  let columnDates: string[] = []
  let columnWeekStart = 0
  // Incomplete slots from the previous matchup line, waiting for a
  // bare-number repair line.
  let pending: PendingSlot[] = []

  for (const line of lines) {
    const lineDates = datesInLine(line, year)
    const slots = slotsInLine(line)
    const isBareNumbers = /^[\d\s]+$/.test(line)

    // Repair line: bare numbers following a line that had split cells.
    if (isBareNumbers && slots.length === 0 && pending.length > 0) {
      const nums = (line.match(/\d{1,2}/g) ?? []).map(Number)
      const n = Math.min(nums.length, pending.length)
      for (let i = 0; i < n; i++) {
        const p = pending[i]
        const p2 = nums[i]
        if (p2 >= 1 && p2 <= 99 && p2 !== p.p1) {
          rows.push({
            week_number: p.week_number,
            match_date: p.match_date,
            start_time: p.time,
            court: p.court,
            player1_seed: p.p1,
            player2_seed: p2,
          })
        }
      }
      pending = []
      continue
    }

    // Header line: dates, no matchups.
    if (lineDates.length > 0 && slots.length === 0) {
      columnDates = lineDates
      columnWeekStart = allDates.length
      for (const d of lineDates) allDates.push(d)
      pending = []
      continue
    }

    // Matchup line: assign slots to columns by order.
    if (slots.length > 0 && columnDates.length > 0) {
      pending = []
      const N = Math.min(slots.length, columnDates.length)
      for (let i = 0; i < N; i++) {
        const slot = slots[i]
        const week_number = columnWeekStart + i + 1
        const match_date = columnDates[i]
        if (slot.p2 === null) {
          pending.push({
            p1: slot.p1,
            time: slot.time,
            court: slot.court,
            week_number,
            match_date,
          })
        } else {
          rows.push({
            week_number,
            match_date,
            start_time: slot.time,
            court: slot.court,
            player1_seed: slot.p1,
            player2_seed: slot.p2,
          })
        }
      }
      continue
    }

    // Anything else (titles, footers) clears pending repairs.
    pending = []
  }

  return rows
}
