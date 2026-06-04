import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useContacts } from '../contacts/useContacts'
import { useMatches, type Match } from './useMatches'
import { summarizeHeadToHead, type MatchSummary } from '../lib/scoring'
import { MatchHistory } from './MatchHistory'

function toSummary(matches: Match[], userId: string, contactsById: Map<string, { name: string }>): MatchSummary[] {
  return matches
    .map((m) => {
      const youArePlayer1 = m.player1_user_id === userId
      if (!youArePlayer1 && m.player2_user_id !== userId) return null
      const yourGames = youArePlayer1 ? m.player1_games_won : m.player2_games_won
      const theirGames = youArePlayer1 ? m.player2_games_won : m.player1_games_won
      const oppContactId = youArePlayer1 ? m.player2_contact_id : m.player1_contact_id
      if (!oppContactId) return null
      const opp = contactsById.get(oppContactId)
      return {
        youWon: yourGames > theirGames,
        opponentId: oppContactId,
        opponentName: opp?.name ?? '(deleted)',
        yourGames,
        theirGames,
      } satisfies MatchSummary
    })
    .filter((x): x is MatchSummary => x !== null)
}

export function Stats() {
  const { session } = useAuth()
  const { contacts, loading: contactsLoading } = useContacts()
  const { matches, loading: matchesLoading } = useMatches()
  const [summary, setSummary] = useState<ReturnType<typeof summarizeHeadToHead> | null>(null)

  const userId = session?.user.id
  const contactsById = new Map(contacts.map((c) => [c.id, c]))

  useEffect(() => {
    if (!userId) return
    const ms = toSummary(matches, userId, contactsById)
    setSummary(summarizeHeadToHead(ms, userId))
  }, [matches, contacts, userId])

  if (!userId || matchesLoading || contactsLoading || !summary) {
    return <div className="p-4">Loading…</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Stats</h1>

      <div className="bg-white rounded-2xl shadow p-4">
        <div className="text-sm text-slate-500">Overall</div>
        <div className="text-2xl font-bold">
          {summary.overall.wins}–{summary.overall.losses}
        </div>
        <div className="text-xs text-slate-500">
          {summary.overall.played} match{summary.overall.played === 1 ? '' : 'es'} played
        </div>
      </div>

      {summary.perOpponent.length > 0 && (
        <div className="bg-white rounded-2xl shadow">
          <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">Head-to-head</div>
          <ul className="divide-y divide-slate-200">
            {summary.perOpponent.map((r) => (
              <li key={r.opponentId} className="px-4 py-2 flex justify-between">
                <span className="font-medium">{r.opponentName}</span>
                <span className={r.wins >= r.losses ? 'text-emerald-700' : 'text-slate-600'}>
                  {r.wins}–{r.losses}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-sm font-medium text-slate-600 mb-1">Recent matches</div>
        <MatchHistory matches={matches.slice(0, 10)} contactsById={contactsById} userId={userId} />
      </div>
    </div>
  )
}
