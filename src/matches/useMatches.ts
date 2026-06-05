import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Match = {
  id: string
  league_id: string | null
  match_date: string
  player1_user_id: string | null
  player1_contact_id: string | null
  player2_user_id: string | null
  player2_contact_id: string | null
  player1_games_won: number
  player2_games_won: number
  notes: string | null
  entered_by: string
  created_at: string
}

export type NewMatchInput = {
  match_date: string
  league_id?: string | null
  opponent_contact_id?: string | null
  opponent_user_id?: string | null
  your_games: number
  their_games: number
  notes: string | null
}

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: false })
    if (error) setError(error.message)
    else setMatches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const addMatch = useCallback(async (input: NewMatchInput) => {
    const { data: u } = await supabase.auth.getUser()
    const me = u.user?.id
    if (!me) throw new Error('Not authenticated')
    const row = {
      league_id: input.league_id ?? null,
      match_date: input.match_date,
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: input.opponent_user_id ?? null,
      player2_contact_id: input.opponent_user_id ? null : (input.opponent_contact_id ?? null),
      player1_games_won: input.your_games,
      player2_games_won: input.their_games,
      notes: input.notes,
      entered_by: me,
    }
    const { data, error } = await supabase.from('matches').insert(row).select().single()
    if (error) throw error
    setMatches((prev) => [data as Match, ...prev])
    return data as Match
  }, [])

  return { matches, loading, error, addMatch, reload }
}
