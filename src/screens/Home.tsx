import { useAuth } from '../auth/useAuth'
import { useContacts } from '../contacts/useContacts'
import { useMatches } from '../matches/useMatches'
import { MatchHistory } from '../matches/MatchHistory'

export function Home() {
  const { session } = useAuth()
  const { matches, loading: matchesLoading } = useMatches()
  const { contacts } = useContacts()
  const userId = session?.user.id

  if (!userId || matchesLoading) return <div className="p-4">Loading…</div>

  const contactsById = new Map(contacts.map((c) => [c.id, c]))
  const wins = matches.filter((m) =>
    (m.player1_user_id === userId ? m.player1_games_won : m.player2_games_won) >
    (m.player1_user_id === userId ? m.player2_games_won : m.player1_games_won)
  ).length
  const losses = matches.length - wins

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="text-sm text-slate-500">Your record</div>
        <div className="text-3xl font-bold">{wins}–{losses}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-600 mb-1">Recent matches</div>
        <MatchHistory matches={matches.slice(0, 5)} contactsById={contactsById} userId={userId} />
      </div>
    </div>
  )
}
