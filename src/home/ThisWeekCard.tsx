import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { buildSmsHref } from '../lib/sms'

type Upcoming = {
  id: string
  match_date: string
  start_time: string | null
  court: string | null
  opponent_name: string
  opponent_phone: string | null
  league_name: string
}

export function ThisWeekCard() {
  const { session } = useAuth()
  const [up, setUp] = useState<Upcoming | null>(null)
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState(
    "Hey just verifying our match for {date}. sent via Jim's racquetball app",
  )

  useEffect(() => {
    const me = session?.user.id
    if (!me) return
    let active = true
    ;(async () => {
      const [{ data: members }, { data: profile }] = await Promise.all([
        supabase
          .from('league_members')
          .select('id, league_id, leagues(name)')
          .eq('user_id', me),
        supabase
          .from('profiles')
          .select('default_text_template')
          .eq('id', me)
          .maybeSingle(),
      ])
      if (profile?.default_text_template) setTemplate(profile.default_text_template)

      if (!members || members.length === 0) {
        if (active) setLoading(false)
        return
      }

      const myMemberIds = members.map((m) => m.id as string)
      const leagueNameByMemberId = new Map<string, string>()
      for (const m of members) {
        const raw = (m as { leagues?: unknown }).leagues
        const leagueName =
          (Array.isArray(raw) ? (raw[0] as { name?: string })?.name : (raw as { name?: string })?.name) ??
          'League'
        leagueNameByMemberId.set(m.id as string, leagueName)
      }

      const today = new Date()
      const start = new Date(today)
      start.setDate(today.getDate() - 1)
      const end = new Date(today)
      end.setDate(today.getDate() + 14)
      const startIso = start.toISOString().slice(0, 10)
      const endIso = end.toISOString().slice(0, 10)

      const { data: rows } = await supabase
        .from('league_schedule')
        .select('*')
        .gte('match_date', startIso)
        .lte('match_date', endIso)
        .or(
          myMemberIds
            .map(
              (id) =>
                `player1_member_id.eq.${id},player2_member_id.eq.${id}`,
            )
            .join(','),
        )
        .order('match_date')
        .limit(1)

      if (!rows || rows.length === 0) {
        if (active) setLoading(false)
        return
      }
      const row = rows[0]
      const myMemberId =
        myMemberIds.find(
          (id) =>
            row.player1_member_id === id || row.player2_member_id === id,
        ) ?? null
      const oppId =
        row.player1_member_id === myMemberId
          ? row.player2_member_id
          : row.player1_member_id
      if (!oppId) {
        if (active) setLoading(false)
        return
      }

      const { data: opp } = await supabase
        .from('league_members')
        .select('name, phone')
        .eq('id', oppId)
        .single()

      if (!active) return
      setUp({
        id: row.id,
        match_date: row.match_date,
        start_time: row.start_time,
        court: row.court,
        opponent_name: opp?.name ?? 'Opponent',
        opponent_phone: opp?.phone ?? null,
        league_name: leagueNameByMemberId.get(myMemberId ?? '') ?? 'League',
      })
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [session])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow p-4 text-sm">
        Loading this week…
      </div>
    )
  }
  if (!up) return null

  const time = up.start_time ? up.start_time.slice(0, 5) : ''
  const when = `${up.match_date}${time ? ` @ ${time}` : ''}`
  const href = up.opponent_phone
    ? buildSmsHref({
        phone: up.opponent_phone,
        template,
        vars: {
          name: up.opponent_name.split(' ')[0],
          when,
          date: up.match_date,
          time,
          court: up.court ?? '',
        },
      })
    : null

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-2">
      <div className="text-xs text-slate-500">{up.league_name} · Week match</div>
      <div className="text-sm">
        <span className="font-medium">{up.match_date}</span>
        {up.start_time && ` @ ${up.start_time.slice(0, 5)}`}
        {up.court && ` · Court ${up.court}`}
      </div>
      <div className="text-lg font-semibold">vs {up.opponent_name}</div>
      {href ? (
        <a
          href={href}
          className="block w-full rounded bg-emerald-600 text-white py-3 font-medium text-center"
        >
          Text {up.opponent_name.split(' ')[0]}
        </a>
      ) : (
        <p className="text-xs text-slate-500">No phone on file for opponent.</p>
      )}
    </div>
  )
}
