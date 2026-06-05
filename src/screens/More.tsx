import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function More() {
  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-semibold mb-4">More</h1>
      <Link
        to="/contacts"
        className="block bg-white rounded-2xl shadow p-4 font-medium"
      >
        Contacts
      </Link>
      <Link
        to="/leagues"
        className="block bg-white rounded-2xl shadow p-4 font-medium"
      >
        Leagues
      </Link>
      <Link
        to="/profile"
        className="block bg-white rounded-2xl shadow p-4 font-medium"
      >
        Profile
      </Link>
      <button
        onClick={signOut}
        className="block w-full text-left bg-white rounded-2xl shadow p-4 font-medium text-red-600"
      >
        Sign out
      </button>
    </div>
  )
}
