import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider } from '../src/auth/AuthProvider'
import { useAuth } from '../src/auth/useAuth'

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        mockOnAuthStateChange(cb)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  },
}))

function Probe() {
  const { session, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{session ? `signed-in:${session.user.id}` : 'signed-out'}</div>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
  })

  it('renders loading then signed-out when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await screen.findByText('signed-out')
  })

  it('renders signed-in when session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'abc' } } },
    })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed-in:abc')
  })

  it('updates when auth state changes', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('signed-out')
    const cb = mockOnAuthStateChange.mock.calls[0][0]
    await act(async () => cb('SIGNED_IN', { user: { id: 'xyz' } }))
    await screen.findByText('signed-in:xyz')
  })
})
