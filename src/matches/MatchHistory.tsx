import type { Match } from './useMatches'
import type { Contact } from '../contacts/useContacts'

export function MatchHistory({ matches, contactsById, userId }: {
  matches: Match[]
  contactsById: Map<string, Contact>
  userId: string
}) {
  if (matches.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-6">No matches yet.</p>
  }
  return (
    <ul className="bg-white rounded-2xl shadow divide-y divide-slate-200">
      {matches.map((m) => {
        const youArePlayer1 = m.player1_user_id === userId
        const yourGames = youArePlayer1 ? m.player1_games_won : m.player2_games_won
        const theirGames = youArePlayer1 ? m.player2_games_won : m.player1_games_won
        const oppContactId = youArePlayer1 ? m.player2_contact_id : m.player1_contact_id
        const oppName = oppContactId ? contactsById.get(oppContactId)?.name ?? '(deleted)' : '(unknown)'
        const won = yourGames > theirGames
        return (
          <li key={m.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">{m.match_date}</div>
              <div className="font-medium">vs {oppName}</div>
            </div>
            <div className={`font-semibold ${won ? 'text-emerald-600' : 'text-slate-500'}`}>
              {won ? 'W' : 'L'} {yourGames}–{theirGames}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
