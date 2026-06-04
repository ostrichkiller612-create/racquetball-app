import { describe, it, expect } from 'vitest'
import { parseSchedulePhoto } from '../src/contacts/parseSchedulePhoto'

describe('parseSchedulePhoto', () => {
  it('parses the Thursday C League roster format', () => {
    const text = `
THURSDAY - C LEAGUE
Name  Phone
1  James Herrington  462-0214
2  Bill Boulden  510-4811
3  Stanley Coleman  390-2950
4  Kyle Jeffery  628-7891
5  Pat Smith  480-3577
6  David Mingoia  696-2402
7  Renee Mohan  984-8881
8  Jonelle Gordon  347-805-3588
9  Rob Kennery  984-2296
10  Dave Marotto  713-8105
`
    const rows = parseSchedulePhoto(text)
    expect(rows).toHaveLength(10)
    expect(rows[0]).toEqual({ name: 'James Herrington', phone: '462-0214' })
    expect(rows[7]).toEqual({ name: 'Jonelle Gordon', phone: '347-805-3588' })
  })

  it('skips lines without a phone', () => {
    const text = `Header line
Just a name with no phone
2 Bob Smith 555-1234`
    const rows = parseSchedulePhoto(text)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Bob Smith')
  })

  it('handles dot- and space-separated phones', () => {
    const text = `1 Alice 555.6789
2 Bob 555 1234`
    const rows = parseSchedulePhoto(text)
    expect(rows).toHaveLength(2)
    expect(rows[0].phone).toBe('555-6789')
    expect(rows[1].phone).toBe('555-1234')
  })

  it('strips leading seed numbers of varying widths', () => {
    const text = `1) Alice 555-1234
10. Bob 555-5678
99: Carol 555-9999`
    const rows = parseSchedulePhoto(text)
    expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('deduplicates by name (case-insensitive)', () => {
    const text = `1 Alice 555-1111
2 alice 555-2222
3 Bob 555-3333`
    const rows = parseSchedulePhoto(text)
    expect(rows).toHaveLength(2)
  })

  it('returns empty array for unparseable input', () => {
    expect(parseSchedulePhoto('')).toEqual([])
    expect(parseSchedulePhoto('just garbage no phones here')).toEqual([])
  })
})
