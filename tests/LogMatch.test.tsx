import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LogMatch } from '../src/matches/LogMatch'

const addMatch = vi.fn()

vi.mock('../src/matches/useMatches', () => ({
  useMatches: () => ({ addMatch, matches: [], loading: false }),
}))

vi.mock('../src/contacts/useContacts', () => ({
  useContacts: () => ({
    contacts: [
      { id: 'c-bob', owner_id: 'me', name: 'Bob', phone: null },
      { id: 'c-sue', owner_id: 'me', name: 'Sue', phone: null },
    ],
    loading: false,
  }),
}))

function renderUi() {
  return render(<MemoryRouter><LogMatch /></MemoryRouter>)
}

describe('LogMatch', () => {
  beforeEach(() => { addMatch.mockReset().mockResolvedValue({ id: 'new' }) })

  it('refuses to submit without an opponent', async () => {
    renderUi()
    expect(screen.getByRole('button', { name: /save match/i })).toBeDisabled()
  })

  it('rejects a tie score', async () => {
    renderUi()
    await userEvent.click(screen.getByPlaceholderText(/search contacts/i))
    await userEvent.click(screen.getByText('Bob'))
    const [yours, theirs] = screen.getAllByRole('spinbutton')
    await userEvent.clear(yours); await userEvent.type(yours, '1')
    await userEvent.clear(theirs); await userEvent.type(theirs, '1')
    await userEvent.click(screen.getByRole('button', { name: /save match/i }))
    expect(await screen.findByText(/ties are not allowed/i)).toBeInTheDocument()
    expect(addMatch).not.toHaveBeenCalled()
  })

  it('submits a valid match', async () => {
    renderUi()
    await userEvent.click(screen.getByPlaceholderText(/search contacts/i))
    await userEvent.click(screen.getByText('Bob'))
    await userEvent.click(screen.getByRole('button', { name: /save match/i }))
    expect(addMatch).toHaveBeenCalledWith(expect.objectContaining({
      opponent_contact_id: 'c-bob',
      your_games: 2,
      their_games: 0,
    }))
  })
})
