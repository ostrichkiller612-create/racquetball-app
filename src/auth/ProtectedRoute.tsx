import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { ProfileSetup } from '../profile/ProfileSetup'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) {
      setHasProfile(null)
      return
    }
    let active = true
    supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setHasProfile(!!data)
      })
    return () => {
      active = false
    }
  }, [session])

  if (loading) return <div className="p-6">Loading…</div>
  if (!session) return <Navigate to="/signin" replace />
  if (hasProfile === null) return <div className="p-6">Loading profile…</div>
  if (!hasProfile) {
    return <ProfileSetup userId={session.user.id} onDone={() => setHasProfile(true)} />
  }
  return <>{children}</>
}
