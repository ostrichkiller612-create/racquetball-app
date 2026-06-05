import type { Match } from './useMatches'
import type { Contact } from '../contacts/useContacts'
import { didIWin } from '../lib/scoring'

function contactName(contactsById: Map<string, Contact>, contactId: string | null): string {
  if (!contactId) return '(unknown)'
  return contactsById.get(contactId)?.name ?? '(deleted)'
}

function summarize(m: Match, userId: string, contactsById: Map<string, Contact>): { line: string; tag: string } {
  if (m.match_type === 'singles') {
    const youArePlayer1 = m.player1_user_id === userId
    const yourGames = youArePlayer1 ? m.player1_games_won : m.player2_games_won
    const theirGames = youArePlayer1 ? m.player2_games_won : m.player1_games_won
    const oppContactId = youArePlayer1 ? m.player2_contact_id : m.player1_contact_id
    return {
      line: `vs ${contactName(contactsById, oppContactId)}`,
      tag: `${didIWin(m, userId) ? 'W' : 'L'} ${yourGames}–${theirGames}`,
    }
  }
  if (m.match_type === 'cutthroat') {
    const others = [m.player1_user_id, m.player2_user_id, m.player3_user_id]
      .map((uid, i) => {
        if (uid === userId) return null
        const cid = [m.player1_contact_id, m.player2_contact_id, m.player3_contact_id][i]
        return contactName(contactsById, cid)
      })
      .filter((x): x is string => x !== null)
    return {
      line: `Cutthroat — vs ${others.join(', ')}`,
      tag: didIWin(m, userId) ? 'W' : 'L',
    }
  }
  const myTeam = m.player1_user_id === userId || m.player2_user_id === userId ? 1 : 2
  const teamContacts = myTeam === 1 ? [m.player2_contact_id] : [m.player3_contact_id, m.player4_contact_id]
  const oppContacts = myTeam === 1 ? [m.player3_contact_id, m.player4_contact_id] : [m.player1_contact_id, m.player2_contact_id]
  const partner = teamContacts.map((c) => contactName(contactsById, c)).filter((s) => s !== '(unknown)')[0] ?? '?'
  const opps = oppContacts.map((c) => contactName(contactsById, c))
  return {
    line: `Doubles — you/${partner} vs ${opps.join(' / ')}`,
    tag: didIWin(m, userId) ? 'W' : 'L',
  }
}

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
        const { line, tag } = summarize(m, userId, contactsById)
        const won = didIWin(m, userId)
        return (
          <li key={m.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">{m.match_date}</div>
              <div className="font-medium">{line}</div>
            </div>
            <div className={`font-semibold ${won ? 'text-emerald-600' : 'text-slate-500'}`}>
              {tag}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
