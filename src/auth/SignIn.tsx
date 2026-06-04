import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  async function handleMagic() {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setError(error.message)
    else setMagicSent(true)
  }

  async function handleGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {magicSent && <p className="text-emerald-700 text-sm">Check your email for a sign-in link.</p>}

        <form onSubmit={handlePassword} className="space-y-3">
          <label className="block text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-emerald-600 text-white py-2 font-medium"
          >
            Sign in with password
          </button>
        </form>

        <button
          type="button"
          onClick={handleMagic}
          className="w-full rounded border border-slate-300 py-2 font-medium"
        >
          Email me a link
        </button>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded border border-slate-300 py-2 font-medium"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}
