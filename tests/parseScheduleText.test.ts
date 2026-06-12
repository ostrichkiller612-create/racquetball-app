import { describe, it, expect } from 'vitest'
import { parseScheduleText } from '../src/lib/parseScheduleText'

describe('parseScheduleText', () => {
  it('parses a single-column week block', () => {
    const text = `
16-Jan Time Court
1 vs 10 6:00 1
2 vs 9 6:00 2
3 vs 8 6:00 3
4 vs 7 7:00 1
5 vs 6 7:00 2
`
    const rows = parseScheduleText(text, 2026)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toEqual({
      week_number: 1,
      match_date: '2026-01-16',
      start_time: '18:00',
      court: '1',
      player1_seed: 1,
      player2_seed: 10,
    })
  })

  it('assigns matchups to columns in a multi-week grid line', () => {
    const text = `
14-May   Time   Court   21-May   Time   Court   28-May   Time   Court
1   VS   8   5:00   1   1   VS   7   5:00   1   1   VS   6   5:00   1
`
    const rows = parseScheduleText(text, 2026)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => [r.week_number, r.match_date, r.player2_seed])).toEqual([
      [1, '2026-05-14', 8],
      [2, '2026-05-21', 7],
      [3, '2026-05-28', 6],
    ])
  })

  it('never misreads a time as the opponent', () => {
    const text = `
14-May
2   VS   5:00   2
`
    const rows = parseScheduleText(text, 2026)
    // Incomplete slot with no repair line → dropped, NOT "2 vs 5".
    expect(rows).toHaveLength(0)
  })

  it('repairs split cells from a bare-number line (real PDF pattern)', () => {
    const text = `
14-May   Time   Court   21-May   Time   Court   28-May   Time   Court   4-Jun Time   Court   11-Jun Time   Court
1   VS   8   5:00   1   1   VS   7   5:00   1   1   VS   6   5:00   1   1   VS   5   5:00   1   1   VS   10   5:00   1
2   VS   5:00   2   8   VS   6   5:00   2   7   VS   5   5:00   2   6   VS   10   5:00   2   5   VS   5:00   2
7   9
3   VS   6   5:00   3   2   VS   5   5:00   3   8   VS   10   5:00   3   7   VS   9   5:00   3   6   VS   4   5:00   3
`
    const rows = parseScheduleText(text, 2026)
    // Line 2: 5 complete. Line 3: 3 complete + 2 repaired. Line 5: 5 complete. = 15
    expect(rows).toHaveLength(15)

    // The repaired matchups: week 1 "2 vs 7" and week 5 "5 vs 9".
    const wk1Repaired = rows.find((r) => r.week_number === 1 && r.player1_seed === 2)
    expect(wk1Repaired).toMatchObject({
      match_date: '2026-05-14',
      player2_seed: 7,
      start_time: '17:00',
      court: '2',
    })
    const wk5Repaired = rows.find((r) => r.week_number === 5 && r.player1_seed === 5)
    expect(wk5Repaired).toMatchObject({
      match_date: '2026-06-11',
      player2_seed: 9,
      start_time: '17:00',
      court: '2',
    })

    // A complete one from the same line keeps its own column.
    const wk2 = rows.find((r) => r.week_number === 2 && r.player1_seed === 8)
    expect(wk2).toMatchObject({ match_date: '2026-05-21', player2_seed: 6 })
  })

  it('treats bare times as PM and honors explicit AM', () => {
    const text = `
16-Jan
1 vs 10 6:00 1
2 vs 9 6:00 AM 2
3 vs 8 12:00 3
`
    const rows = parseScheduleText(text, 2026)
    expect(rows.map((r) => r.start_time)).toEqual(['18:00', '06:00', '12:00'])
  })

  it('handles missing time and court', () => {
    const text = `
16-Jan
1 vs 10
`
    const rows = parseScheduleText(text, 2026)
    expect(rows[0].start_time).toBeNull()
    expect(rows[0].court).toBeNull()
  })

  it('accepts US-format dates with explicit year', () => {
    const text = `
1/16/26
1 vs 10 6:00 1
`
    const rows = parseScheduleText(text, 2030)
    expect(rows[0].match_date).toBe('2026-01-16')
  })

  it('increments weeks across multiple header lines', () => {
    const text = `
16-Jan Time Court 23-Jan Time Court
1 vs 10 6:00 1 1 vs 9 6:00 1
30-Jan Time Court
1 vs 8 6:00 1
`
    const rows = parseScheduleText(text, 2026)
    expect(rows.map((r) => r.week_number)).toEqual([1, 2, 3])
  })

  it('returns empty for garbage', () => {
    expect(parseScheduleText('no schedule here', 2026)).toEqual([])
    expect(parseScheduleText('', 2026)).toEqual([])
  })

  it('skips self-matchups and out-of-range seeds', () => {
    const text = `
16-Jan
3 vs 3 6:00 1
1 vs 10 6:00 2
`
    const rows = parseScheduleText(text, 2026)
    expect(rows).toHaveLength(1)
    expect(rows[0].player1_seed).toBe(1)
  })
})
