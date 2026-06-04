import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn } from './auth/SignIn'
import { ProtectedRoute } from './auth/ProtectedRoute'

function Placeholder({ name }: { name: string }) {
  return <div className="p-6 text-xl">{name} (coming soon)</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Placeholder name="App shell placeholder" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
