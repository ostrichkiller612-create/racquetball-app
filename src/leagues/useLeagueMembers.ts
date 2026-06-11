import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type LeagueMember = {
  id: string
  league_id: string
  user_id: string | null
  seed_number: number
  name: string
  phone: string | null
  email: string | null
  role: 'admin' | 'member'
  board_points?: number | null
  board_updated_at?: string | null
}

export type NewMember = {
  seed_number: number
  name: string
  phone: string | null
  email: string | null
}

export function useLeagueMembers(leagueId: string | null) {
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!leagueId) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('league_members')
      .select('*')
      .eq('league_id', leagueId)
      .order('seed_number')
    if (error) setError(error.message)
    else setMembers((data as LeagueMember[]) ?? [])
    setLoading(false)
  }, [leagueId])

  useEffect(() => {
    reload()
  }, [reload])

  const addMember = useCallback(
    async (input: NewMember) => {
      if (!leagueId) throw new Error('No league selected')
      const { data, error } = await supabase
        .from('league_members')
        .insert({ ...input, league_id: leagueId })
        .select()
        .single()
      if (error) throw error
      setMembers((prev) =>
        [...prev, data as LeagueMember].sort((a, b) => a.seed_number - b.seed_number),
      )
      return data as LeagueMember
    },
    [leagueId],
  )

  const updateMember = useCallback(async (id: string, patch: Partial<NewMember>) => {
    const { error } = await supabase.from('league_members').update(patch).eq('id', id)
    if (error) throw error
    setMembers((prev) =>
      prev
        .map((m) => (m.id === id ? ({ ...m, ...patch } as LeagueMember) : m))
        .sort((a, b) => a.seed_number - b.seed_number),
    )
  }, [])

  const deleteMember = useCallback(async (id: string) => {
    const { error } = await supabase.from('league_members').delete().eq('id', id)
    if (error) throw error
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return { members, loading, error, addMember, updateMember, deleteMember, reload }
}
