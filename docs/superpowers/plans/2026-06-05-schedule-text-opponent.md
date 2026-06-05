# Schedule & Text-Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each league gets a weekly schedule (date, time, court, two players). Home tab shows the current user's scheduled match this week with a big "Text Opponent" button that opens the messaging app pre-filled. Admin enters the schedule manually for now (Plan 5 will OCR the schedule PDF).

**Architecture:** New `league_schedule` table. New `useLeagueSchedule` hook. Schedule editor lives inside the existing League detail page (admin-only). Home tab adds a "This Week" card above the existing record card. Pure `buildSmsHref` function builds the `sms:` URL with template interpolation.

**Working directory:** `C:\Users\jim.h\OneDrive - Pine Pharmaceuticals\Desktop\racquetball-app`

---

## File Structure (additions)

```
src/
├── lib/
│   └── sms.ts                 # buildSmsHref({phone, template, vars})
├── leagues/
│   ├── ScheduleEditor.tsx     # admin UI inside League page
│   ├── ScheduleRow.tsx        # one row, editable
│   └── useLeagueSchedule.ts   # CRUD + thisWeekForUser query
├── home/
│   └── ThisWeekCard.tsx       # "Thu 6:00 Court 1 vs Bob — [Text Bob]"
├── profile/
│   └── ProfileEdit.tsx        # edit display_name, phone, text template
supabase/migrations/
└── 0006_league_schedule.sql
tests/
├── sms.test.ts
└── useLeagueSchedule.test.tsx
```

---

### Task 1: league_schedule migration (USER RUNS SQL)

**Files:**
- Create: `supabase/migrations/0006_league_schedule.sql`

- [ ] **Step 1: Write migration**

```sql
create table public.league_schedule (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number int not null,
  match_date date not null,
  start_time time,
  court text,
  player1_member_id uuid references public.league_members(id) on delete cascade,
  player2_member_id uuid references public.league_members(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index league_schedule_league_date_idx on public.league_schedule (league_id, match_date);
create index league_schedule_player1_idx on public.league_schedule (player1_member_id);
create index league_schedule_player2_idx on public.league_schedule (player2_member_id);

alter table public.league_schedule enable row level security;

-- Members can see their league's schedule
create policy "league_schedule_select_if_member"
  on public.league_schedule for select to authenticated
  using (public.is_league_member(league_id));

-- Only league admins (creators) can edit
create policy "league_schedule_insert_admin"
  on public.league_schedule for insert to authenticated
  with check (exists (
    select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()
  ));

create policy "league_schedule_update_admin"
  on public.league_schedule for update to authenticated
  using (exists (
    select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()
  ));

create policy "league_schedule_delete_admin"
  on public.league_schedule for delete to authenticated
  using (exists (
    select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid()
  ));
```

- [ ] **Step 2: User applies migration** in Supabase SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: league_schedule table migration"
```

---

### Task 2: lib/sms.ts (TDD)

**Files:**
- Create: `src/lib/sms.ts`, `tests/sms.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildSmsHref } from '../src/lib/sms'

describe('buildSmsHref', () => {
  it('returns a properly encoded sms: href with body', () => {
    const href = buildSmsHref({
      phone: '555-123-4567',
      template: 'Hey {name}, want to play {when}?',
      vars: { name: 'Bob', when: 'Tuesday 6pm' },
    })
    expect(href).toBe('sms:5551234567?body=Hey%20Bob%2C%20want%20to%20play%20Tuesday%206pm%3F')
  })

  it('handles a +1 prefixed phone', () => {
    expect(buildSmsHref({ phone: '+15551234567', template: 'hi', vars: {} }))
      .toBe('sms:+15551234567?body=hi')
  })

  it('leaves unmatched template vars as-is', () => {
    const href = buildSmsHref({
      phone: '5551234567',
      template: 'Hey {name} on {date}',
      vars: { name: 'Bob' },
    })
    expect(decodeURIComponent(href.split('body=')[1])).toBe('Hey Bob on {date}')
  })

  it('throws when phone is missing or empty', () => {
    expect(() => buildSmsHref({ phone: '', template: 'x', vars: {} })).toThrow()
  })
})
```

- [ ] **Step 2: Implement**

```ts
export type SmsInput = {
  phone: string
  template: string
  vars: Record<string, string>
}

export function buildSmsHref({ phone, template, vars }: SmsInput): string {
  if (!phone || !phone.trim()) {
    throw new Error('Phone is required')
  }
  // Keep + prefix; strip everything else non-digit
  const cleaned = phone.startsWith('+')
    ? '+' + phone.slice(1).replace(/\D/g, '')
    : phone.replace(/\D/g, '')

  let body = template
  for (const [k, v] of Object.entries(vars)) {
    body = body.replaceAll(`{${k}}`, v)
  }
  return `sms:${cleaned}?body=${encodeURIComponent(body)}`
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test
git add .
git commit -m "feat: buildSmsHref pure function"
```

---

### Task 3: useLeagueSchedule hook (TDD)

**Files:**
- Create: `src/leagues/useLeagueSchedule.ts`, `tests/useLeagueSchedule.test.tsx`

Returns the league's schedule plus admin CRUD:
- `schedule` — all rows sorted by date
- `addRow(input)`, `updateRow(id, patch)`, `deleteRow(id)`

**Type:**

```ts
export type ScheduleRow = {
  id: string
  league_id: string
  week_number: number
  match_date: string         // YYYY-MM-DD
  start_time: string | null  // HH:MM[:SS]
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
```

- [ ] **Step 1: Failing test**

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useLeagueSchedule } from '../src/leagues/useLeagueSchedule'

const insert = vi.fn()
const update = vi.fn()
const del = vi.fn()

vi.mock('../src/lib/supabase', () => {
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({ order: () => Promise.resolve({ data: [
        { id: 'S1', league_id: 'L1', week_number: 1, match_date: '2026-06-04',
          start_time: '18:00', court: '1',
          player1_member_id: 'M1', player2_member_id: 'M2',
          match_id: null, notes: null },
      ], error: null }) }),
    }),
    insert: (row: unknown) => {
      insert(row)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'S2', ...(row as object) }, error: null }) }) }
    },
    update: (patch: unknown) => {
      update(patch)
      return { eq: () => Promise.resolve({ error: null }) }
    },
    delete: () => { del(); return { eq: () => Promise.resolve({ error: null }) } },
  }))
  return { supabase: { from } }
})

describe('useLeagueSchedule', () => {
  beforeEach(() => { insert.mockReset(); update.mockReset(); del.mockReset() })

  it('loads schedule for league', async () => {
    const { result } = renderHook(() => useLeagueSchedule('L1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.schedule).toHaveLength(1)
  })

  it('inserts a new row', async () => {
    const { result } = renderHook(() => useLeagueSchedule('L1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.addRow({
        week_number: 2, match_date: '2026-06-11',
        start_time: '18:00', court: '1',
        player1_member_id: 'M1', player2_member_id: 'M3',
      })
    })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      league_id: 'L1', week_number: 2, match_date: '2026-06-11',
    }))
  })
})
```

- [ ] **Step 2: Implement**

```ts
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
    if (!leagueId) { setSchedule([]); setLoading(false); return }
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

  useEffect(() => { reload() }, [reload])

  const addRow = useCallback(async (input: NewScheduleRow) => {
    if (!leagueId) throw new Error('No league selected')
    const { data, error } = await supabase
      .from('league_schedule')
      .insert({ ...input, league_id: leagueId })
      .select()
      .single()
    if (error) throw error
    setSchedule((prev) => [...prev, data as ScheduleRow].sort((a, b) =>
      a.match_date.localeCompare(b.match_date)
    ))
    return data as ScheduleRow
  }, [leagueId])

  const updateRow = useCallback(async (id: string, patch: Partial<NewScheduleRow>) => {
    const { error } = await supabase.from('league_schedule').update(patch).eq('id', id)
    if (error) throw error
    setSchedule((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as ScheduleRow : r)))
  }, [])

  const deleteRow = useCallback(async (id: string) => {
    const { error } = await supabase.from('league_schedule').delete().eq('id', id)
    if (error) throw error
    setSchedule((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { schedule, loading, error, addRow, updateRow, deleteRow, reload }
}
```

- [ ] **Step 3: Run + commit**

---

### Task 4: ScheduleEditor UI inside League page

**Files:**
- Create: `src/leagues/ScheduleEditor.tsx`
- Modify: `src/leagues/League.tsx` (mount ScheduleEditor below Roster)

The editor lets the admin:
- See all rows grouped by week
- Add a row (date picker, time, court, two member dropdowns)
- Delete a row

UI: under the existing Roster card, add a new "Schedule" card. If `isAdmin`, show "+ Add match" button and per-row delete buttons. Otherwise just display.

Implementation: build `ScheduleEditor.tsx` that takes `leagueId`, `members`, `isAdmin` as props and renders the list + an inline add-form (mirroring how MemberForm works). Use `useLeagueSchedule(leagueId)`.

```tsx
import { useState } from 'react'
import { useLeagueSchedule } from './useLeagueSchedule'
import type { LeagueMember } from './useLeagueMembers'

export function ScheduleEditor({ leagueId, members, isAdmin }: {
  leagueId: string; members: LeagueMember[]; isAdmin: boolean
}) {
  const { schedule, loading, addRow, deleteRow } = useLeagueSchedule(leagueId)
  const [adding, setAdding] = useState(false)
  const [weekNumber, setWeekNumber] = useState(1)
  const [matchDate, setMatchDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [court, setCourt] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const memberById = new Map(members.map((m) => [m.id, m]))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!matchDate || !p1 || !p2 || p1 === p2) {
      setError('Need date and two different players.')
      return
    }
    setSaving(true); setError(null)
    try {
      await addRow({
        week_number: weekNumber,
        match_date: matchDate,
        start_time: startTime || null,
        court: court || null,
        player1_member_id: p1,
        player2_member_id: p2,
      })
      setAdding(false)
      setMatchDate(''); setStartTime(''); setCourt(''); setP1(''); setP2('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b flex items-center justify-between">
        <span>Schedule ({schedule.length})</span>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="text-emerald-700 text-sm">+ Add match</button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="p-3 space-y-2 border-b">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <label className="text-sm w-20">Week
              <input type="number" min={1} value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-2" />
            </label>
            <label className="text-sm flex-1">Date
              <input type="date" value={matchDate} required
                onChange={(e) => setMatchDate(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="text-sm flex-1">Time
              <input type="time" value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm w-20">Court
              <input value={court} onChange={(e) => setCourt(e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-2" />
            </label>
          </div>
          <label className="block text-sm">Player 1
            <select value={p1} onChange={(e) => setP1(e.target.value)} required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 bg-white">
              <option value="">— pick —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>#{m.seed_number} {m.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">Player 2
            <select value={p2} onChange={(e) => setP2(e.target.value)} required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 bg-white">
              <option value="">— pick —</option>
              {members.filter((m) => m.id !== p1).map((m) => (
                <option key={m.id} value={m.id}>#{m.seed_number} {m.name}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="flex-1 rounded border border-slate-300 py-2 font-medium">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="p-3 text-sm text-slate-500">Loading…</p>
      ) : schedule.length === 0 ? (
        <p className="p-3 text-sm text-slate-500">No matches scheduled yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {schedule.map((s) => {
            const p1m = s.player1_member_id ? memberById.get(s.player1_member_id) : null
            const p2m = s.player2_member_id ? memberById.get(s.player2_member_id) : null
            return (
              <li key={s.id} className="px-4 py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">
                    Week {s.week_number} — {s.match_date}
                    {s.start_time && ` @ ${s.start_time.slice(0, 5)}`}
                    {s.court && ` · Court ${s.court}`}
                  </div>
                  <div className="font-medium">
                    {p1m ? `#${p1m.seed_number} ${p1m.name}` : '(?)'} vs {p2m ? `#${p2m.seed_number} ${p2m.name}` : '(?)'}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { if (confirm('Delete this match?')) deleteRow(s.id) }}
                    className="text-red-600 text-xs"
                  >Delete</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

Then in `src/leagues/League.tsx`:
- Import `ScheduleEditor`
- Render `<ScheduleEditor leagueId={id} members={members} isAdmin={isAdmin} />` below the Roster card

- [ ] **Step 1: Build ScheduleEditor**
- [ ] **Step 2: Mount in League page**
- [ ] **Step 3: Build + commit**

---

### Task 5: Home "This Week" card

**Files:**
- Create: `src/home/ThisWeekCard.tsx`
- Modify: `src/screens/Home.tsx` (insert above the existing record card)

The card queries league_schedule for matches:
- Where the user is one of the two players (via `league_members.user_id = me`)
- Where `match_date` is within ±7 days of today

Show the soonest match with the "Text [opponent]" button.

```tsx
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
  const [template, setTemplate] = useState('Hey {name}, confirming our match {when}?')

  useEffect(() => {
    const me = session?.user.id
    if (!me) return
    let active = true
    ;(async () => {
      // Find my league_members rows (and pull my text template from profile in parallel)
      const [{ data: members }, { data: profile }] = await Promise.all([
        supabase.from('league_members').select('id, league_id, leagues(name)').eq('user_id', me),
        supabase.from('profiles').select('default_text_template').eq('id', me).maybeSingle(),
      ])
      if (profile?.default_text_template) setTemplate(profile.default_text_template)

      if (!members || members.length === 0) { if (active) { setLoading(false) }; return }

      const myMemberIds = members.map((m) => m.id)
      const leagueNameByMemberId = new Map<string, string>()
      for (const m of members) {
        // @ts-expect-error supabase returns nested as object|array
        const leagueName = (m.leagues && (Array.isArray(m.leagues) ? m.leagues[0]?.name : m.leagues.name)) ?? 'League'
        leagueNameByMemberId.set(m.id, leagueName)
      }

      const today = new Date()
      const start = new Date(today); start.setDate(today.getDate() - 1)
      const end = new Date(today); end.setDate(today.getDate() + 14)
      const startIso = start.toISOString().slice(0, 10)
      const endIso = end.toISOString().slice(0, 10)

      const { data: rows } = await supabase
        .from('league_schedule')
        .select('*')
        .gte('match_date', startIso)
        .lte('match_date', endIso)
        .or(myMemberIds.map((id) => `player1_member_id.eq.${id},player2_member_id.eq.${id}`).join(','))
        .order('match_date')
        .limit(1)

      if (!rows || rows.length === 0) { if (active) setLoading(false); return }
      const row = rows[0]
      const myMemberId = myMemberIds.find((id) => row.player1_member_id === id || row.player2_member_id === id) ?? null
      const oppId = row.player1_member_id === myMemberId ? row.player2_member_id : row.player1_member_id
      if (!oppId) { if (active) setLoading(false); return }

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
    return () => { active = false }
  }, [session])

  if (loading) return <div className="bg-white rounded-2xl shadow p-4 text-sm">Loading this week…</div>
  if (!up) return null

  const when = `${up.match_date}${up.start_time ? ` @ ${up.start_time.slice(0, 5)}` : ''}`
  const href = up.opponent_phone
    ? buildSmsHref({
        phone: up.opponent_phone,
        template,
        vars: { name: up.opponent_name.split(' ')[0], when },
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
        <a href={href} className="block w-full rounded bg-emerald-600 text-white py-3 font-medium text-center">
          Text {up.opponent_name.split(' ')[0]}
        </a>
      ) : (
        <p className="text-xs text-slate-500">No phone on file for opponent.</p>
      )}
    </div>
  )
}
```

Then in `src/screens/Home.tsx` import `ThisWeekCard` and render it at the top of the screen, above the existing record card.

- [ ] Build + wire + commit

---

### Task 6: Profile edit (template + phone)

**Files:**
- Create: `src/profile/ProfileEdit.tsx`
- Modify: `src/screens/More.tsx` (link to /profile)
- Modify: `src/shell/AppShell.tsx` (add /profile route)

Simple form that loads the user's profile row, lets them edit display_name, phone, default_text_template, and saves.

Template hint shown to user: "Use {name} and {when} as placeholders."

Build inline (not TDD — straightforward form).

- [ ] Build form + route + commit

---

### Task 7: Deploy + verify

- [ ] Push
- [ ] On phone: open League → add a week's schedule → Home shows the "This Week" card → tap Text button → messaging app opens with prefilled message
- [ ] Tag `plan-4-complete`

---

## Self-Review

Coverage against the design spec:
- ✅ league_schedule table + RLS (Task 1)
- ✅ buildSmsHref pure function (Task 2)
- ✅ useLeagueSchedule hook (Task 3)
- ✅ Admin schedule editor (Task 4)
- ✅ Home This Week card (Task 5)
- ✅ Text opponent button via sms: link (Task 5)
- ✅ Profile edit including text template (Task 6)
- ⏭ PDF schedule import (Plan 5)

Constraints:
- Schedule rows reference league_members rows (not user_ids directly) — so placeholder members can also appear in the schedule with the opponent waiting for sign-up.
- Phone for SMS lives in `league_members.phone` (set by admin when adding the member). Users can keep their own phone in `profiles.phone` for completeness but the schedule reads from member rows so admins control the contact info.
