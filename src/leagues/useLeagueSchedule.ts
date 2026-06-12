import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ScheduleRow = {
  id: string
  league_id: string
  week_number: number
  match_date: string
  start_time: string | null
  court: string | null
  player1_member_id: string | null
  player2_member_id: string | null
  match_id: string | null
  notes: string | null
}

export type NewScheduleRow = {
  week_number: number
  match_date: string
  start_time?: string | null
  court?: string | null
  player1_member_id?: string | null
  player2_member_id?: string | null
  notes?: string | null
}

export function useLeagueSchedule(leagueId: string | null) {
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!leagueId) {
      setSchedule([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('league_schedule')
      .select('*')
      .eq('league_id', leagueId)
      .order('match_date')
    if (error) setError(error.message)
    else setSchedule((data as ScheduleRow[]) ?? [])
    setLoading(false)
  }, [leagueId])

  useEffect(() => {
    reload()
  }, [reload])

  const addRow = useCallback(
    async (input: NewScheduleRow) => {
      if (!leagueId) throw new Error('No league selected')
      const { data, error } = await supabase
        .from('league_schedule')
        .insert({ ...input, league_id: leagueId })
        .select()
        .single()
      if (error) throw error
      setSchedule((prev) =>
        [...prev, data as ScheduleRow].sort((a, b) =>
          a.match_date.localeCompare(b.match_date),
        ),
      )
      return data as ScheduleRow
    },
    [leagueId],
  )

  const updateRow = useCallback(async (id: string, patch: Partial<NewScheduleRow>) => {
    const { error } = await supabase.from('league_schedule').update(patch).eq('id', id)
    if (error) throw error
    setSchedule((prev) =>
      prev.map((r) => (r.id === id ? ({ ...r, ...patch } as ScheduleRow) : r)),
    )
  }, [])

  const deleteRow = useCallback(async (id: string) => {
    const { error } = await supabase.from('league_schedule').delete().eq('id', id)
    if (error) throw error
    setSchedule((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    if (!leagueId) throw new Error('No league selected')
    const { error } = await supabase
      .from('league_schedule')
      .delete()
      .eq('league_id', leagueId)
    if (error) throw error
    setSchedule([])
  }, [leagueId])

  return { schedule, loading, error, addRow, updateRow, deleteRow, clearAll, reload }
}
