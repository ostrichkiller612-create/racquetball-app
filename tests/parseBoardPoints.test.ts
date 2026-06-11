import { describe, it, expect } from 'vitest'
import { parseBoardPoints } from '../src/leagues/parseBoardPoints'
import type { LeagueMember } from '../src/leagues/useLeagueMembers'

function member(id: string, seed: number, name: string): LeagueMember {
  return {
    id, league_id: 'L1', user_id: null, seed_number: seed,
    name, phone: null, email: null, role: 'member',
  }
}

const members = [
  member('M1', 1, 'James Herrington'),
  member('M2', 2, 'Kaleb Zedeck'),
  member('M3', 3, 'Andrew Duwe'),
  member('M4', 4, 'Andrew Keogh'),
]

describe('parseBoardPoints', () => {
  it('matches full names with points on the same line', () => {
    const text = `James Herrington 12
Kaleb Zedeck 9`
    const result = parseBoardPoints(text, members)
    expect(result.get('M1')).toBe(12)
    expect(result.get('M2')).toBe(9)
  })

  it('falls back to last-name matching', () => {
    const text = `Herrington 15`
    const result = parseBoardPoints(text, members)
    expect(result.get('M1')).toBe(15)
  })

  it('disambiguates shared first names by full or last name first', () => {
    const text = `Andrew Duwe 7
Andrew Keogh 11`
    const result = parseBoardPoints(text, members)
    expect(result.get('M3')).toBe(7)
    expect(result.get('M4')).toBe(11)
  })

  it('leaves members out when no line matches', () => {
    const text = `Herrington 5`
    const result = parseBoardPoints(text, members)
    expect(result.has('M2')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('ignores numbers on other lines', () => {
    const text = `Herrington
42`
    const result = parseBoardPoints(text, members)
    expect(result.has('M1')).toBe(false)
  })

  it('handles separators between name and number', () => {
    const text = `Kaleb Zedeck - 14
Duwe: 8`
    const result = parseBoardPoints(text, members)
    expect(result.get('M2')).toBe(14)
    expect(result.get('M3')).toBe(8)
  })

  it('takes the first number after the name when several appear', () => {
    const text = `James Herrington 12 3`
    const result = parseBoardPoints(text, members)
    expect(result.get('M1')).toBe(12)
  })

  it('returns empty map for garbage', () => {
    expect(parseBoardPoints('nothing useful here', members).size).toBe(0)
    expect(parseBoardPoints('', members).size).toBe(0)
  })
})
