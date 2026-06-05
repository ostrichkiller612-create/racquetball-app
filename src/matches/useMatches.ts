import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildMatchRow } from './buildMatchRow'

export type Match = {
  id: string
  league_id: string | null
  match_date: string
  match_type: 'singles' | 'cutthroat' | 'doubles'
  player1_user_id: string | null
  player1_contact_id: string | null
  player2_user_id: string | null
  player2_contact_id: string | null
  player3_user_id: string | null
  player3_contact_id: string | null
  player4_user_id: string | null
  player4_contact_id: string | null
  player1_games_won: number
  player2_games_won: number
  winner_position: number | null
  notes: string | null
  entered_by: string
  created_at: string
}

export type NewMatchInput =
  | {
      type: 'singles'
      match_date: string
      league_id?: string | null
      opponent_contact_id?: string | null
      opponent_user_id?: string | null
      your_games: number
      their_games: number
      notes: string | null
    }
  | {
      type: 'cutthroat'
      match_date: string
      opp1_contact_id?: string | null
      opp1_user_id?: string | null
      opp2_contact_id?: string | null
      opp2_user_id?: string | null
      winner: 'me' | 'opp1' | 'opp2'
      notes: string | null
    }
  | {
      type: 'doubles'
      match_date: string
      partner_contact_id?: string | null
      partner_user_id?: string | null
      opp1_contact_id?: string | null
      opp1_user_id?: string | null
      opp2_contact_id?: string | null
      opp2_user_id?: string | null
      winning_team: 'mine' | 'theirs'
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
    const row = buildMatchRow(input, me)
    const { data, error } = await supabase.from('matches').insert(row).select().single()
    if (error) throw error
    setMatches((prev) => [data as Match, ...prev])
    return data as Match
  }, [])

  return { matches, loading, error, addMatch, reload }
}
