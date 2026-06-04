import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useContacts } from '../src/contacts/useContacts'

const select = vi.fn()
const insert = vi.fn()
const del = vi.fn()
const eq = vi.fn()

vi.mock('../src/lib/supabase', () => {
  const from = vi.fn(() => ({
    select: (...args: unknown[]) => {
      select(...args)
      return {
        order: () => Promise.resolve({ data: [
          { id: '1', name: 'Bob', phone: '555-1234', owner_id: 'me' },
          { id: '2', name: 'Sue', phone: null, owner_id: 'me' },
        ], error: null }),
      }
    },
    insert: (rows: unknown) => {
      insert(rows)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: '3', name: 'Joe', phone: null, owner_id: 'me' }, error: null }) }) }
    },
    delete: () => {
      del()
      return { eq: (...args: unknown[]) => { eq(...args); return Promise.resolve({ error: null }) } }
    },
  }))
  return {
    supabase: {
      from,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'me' } } }) },
    },
  }
})

describe('useContacts', () => {
  beforeEach(() => { select.mockReset(); insert.mockReset(); del.mockReset(); eq.mockReset() })

  it('loads contacts on mount', async () => {
    const { result } = renderHook(() => useContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.contacts).toHaveLength(2)
    expect(result.current.contacts[0].name).toBe('Bob')
  })

  it('inserts a new contact', async () => {
    const { result } = renderHook(() => useContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.addContact({ name: 'Joe', phone: null })
    })
    expect(insert).toHaveBeenCalledWith({ name: 'Joe', phone: null, owner_id: 'me' })
  })

  it('deletes a contact', async () => {
    const { result } = renderHook(() => useContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.deleteContact('1')
    })
    expect(eq).toHaveBeenCalledWith('id', '1')
  })
})
