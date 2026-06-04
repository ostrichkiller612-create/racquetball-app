import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SignIn } from '../src/auth/SignIn'

const signInWithPassword = vi.fn()
const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}))

describe('SignIn', () => {
  beforeEach(() => {
    signInWithPassword.mockReset().mockResolvedValue({ error: null })
    signInWithOtp.mockReset().mockResolvedValue({ error: null })
    signInWithOAuth.mockReset().mockResolvedValue({ error: null })
  })

  it('signs in with email + password', async () => {
    render(<SignIn />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }))
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' })
  })

  it('sends a magic link', async () => {
    render(<SignIn />)
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: /email me a link/i }))
    expect(signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.com' })
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  })

  it('starts Google OAuth', async () => {
    render(<SignIn />)
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google' })
  })
})
