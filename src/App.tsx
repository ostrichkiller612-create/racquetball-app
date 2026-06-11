import { Routes, Route } from 'react-router-dom'
import { SignIn } from './auth/SignIn'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './shell/AppShell'
import { JoinLeague } from './leagues/JoinLeague'

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      {/* Reachable signed-out: stores the league id and bounces to sign-in. */}
      <Route path="/join/:leagueId" element={<JoinLeague />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
