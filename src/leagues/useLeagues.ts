import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type League = {
  id: string
  name: string
  created_by: string
  created_at: string
}

export function useLeagues() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setLeagues(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const createLeague = useCallback(async (input: { name: string; creatorName: string }) => {
    const { data: u } = await supabase.auth.getUser()
    const me = u.user?.id
    const myEmail = u.user?.email
    if (!me) throw new Error('Not authenticated')

    const { data: league, error: lErr } = await supabase
      .from('leagues')
      .insert({ name: input.name, created_by: me })
      .select()
      .single()
    if (lErr) throw lErr

    const { error: mErr } = await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: me,
      seed_number: 1,
      name: input.creatorName,
      email: myEmail ?? null,
      role: 'admin',
    })
    if (mErr) throw mErr

    setLeagues((prev) => [league as League, ...prev])
    return league as League
  }, [])

  return { leagues, loading, error, createLeague, reload }
}
