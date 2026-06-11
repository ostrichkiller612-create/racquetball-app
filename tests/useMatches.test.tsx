import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useMatches } from '../src/matches/useMatches'

const insertCalls = vi.fn()
const orderSpy = vi.fn()

vi.mock('../src/lib/supabase', () => {
  const from = vi.fn(() => ({
    select: () => ({
      order: (...args: unknown[]) => {
        orderSpy(...args)
        return Promise.resolve({
          data: [
            {
              id: 'm1',
              match_date: '2026-06-01',
              player1_user_id: 'me',
              player1_contact_id: null,
              player2_user_id: null,
              player2_contact_id: 'c-bob',
              player1_games_won: 2,
              player2_games_won: 0,
              notes: null,
              league_id: null,
              entered_by: 'me',
              created_at: '2026-06-01T00:00:00Z',
            },
          ],
          error: null,
        })
      },
    }),
    insert: (row: unknown) => {
      insertCalls(row)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new', ...(row as object) }, error: null }) }) }
    },
  }))
  return {
    supabase: {
      from,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'me' } } }) },
    },
  }
})

describe('useMatches', () => {
  beforeEach(() => { insertCalls.mockReset(); orderSpy.mockReset() })

  it('loads matches on mount, newest first', async () => {
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.matches).toHaveLength(1)
    expect(orderSpy).toHaveBeenCalledWith('match_date', { ascending: false })
  })

  it('inserts a new match', async () => {
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.addMatch({
        type: 'singles',
        match_date: '2026-06-04',
        opponent_contact_id: 'c-bob',
        your_games: 2,
        their_games: 1,
        notes: null,
      })
    })
    expect(insertCalls).toHaveBeenCalledWith(expect.objectContaining({
      match_type: 'singles',
      match_date: '2026-06-04',
      player1_user_id: 'me',
      player1_contact_id: null,
      player2_user_id: null,
      player2_contact_id: 'c-bob',
      player3_user_id: null,
      player3_contact_id: null,
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: 2,
      player2_games_won: 1,
      winner_position: null,
      entered_by: 'me',
    }))
  })
})
