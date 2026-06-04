import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Stats } from '../src/matches/Stats'

const myId = 'user-me'

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: myId } }, loading: false }),
}))

vi.mock('../src/contacts/useContacts', () => ({
  useContacts: () => ({
    contacts: [{ id: 'c-bob', owner_id: myId, name: 'Bob', phone: null }],
    loading: false,
  }),
}))

vi.mock('../src/matches/useMatches', () => ({
  useMatches: () => ({
    matches: [
      {
        id: 'm1', league_id: null, match_date: '2026-06-01',
        player1_user_id: myId, player1_contact_id: null,
        player2_user_id: null, player2_contact_id: 'c-bob',
        player1_games_won: 2, player2_games_won: 0,
        notes: null, entered_by: myId, created_at: '',
      },
      {
        id: 'm2', league_id: null, match_date: '2026-05-25',
        player1_user_id: myId, player1_contact_id: null,
        player2_user_id: null, player2_contact_id: 'c-bob',
        player1_games_won: 1, player2_games_won: 2,
        notes: null, entered_by: myId, created_at: '',
      },
    ],
    loading: false,
  }),
}))

describe('Stats', () => {
  it('shows overall W-L', async () => {
    render(<Stats />)
    expect(await screen.findByText('1–1')).toBeInTheDocument()
  })

  it('shows per-opponent record', async () => {
    render(<Stats />)
    expect(await screen.findByText('Bob')).toBeInTheDocument()
  })
})
