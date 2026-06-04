import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6">Loading…</div>
  if (!session) return <Navigate to="/signin" replace />
  return <>{children}</>
}
