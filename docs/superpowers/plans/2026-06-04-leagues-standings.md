# Leagues & Standings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-user leagues. Admin can create a league, add members (with seed numbers), other members can join. Matches can be tagged with a league. Standings page computes points per member from the scoring rule.

**Architecture:** Two new tables (`leagues`, `league_members`). Matches RLS broadens: anyone in a league can read and write matches for that league. Leagues list lives under More → Leagues. Each league has its own detail screen with roster and standings.

**Out of scope (deferred to Plan 4):** League schedule, Home "this week" card, SMS opponent. Plan 5: PDF parsing.

**Tech Stack:** Same as before.

**Working directory:** `C:\Users\jim.h\OneDrive - Pine Pharmaceuticals\Desktop\racquetball-app`

---

## File Structure (additions)

```
src/
├── leagues/
│   ├── Leagues.tsx           # /leagues — list of leagues you're in + create new
│   ├── CreateLeague.tsx      # form
│   ├── League.tsx            # /leagues/:id — roster + standings + admin actions
│   ├── MemberForm.tsx        # add/edit a league member
│   ├── Standings.tsx         # computed standings table
│   ├── useLeagues.ts
│   └── useLeagueMembers.ts
supabase/migrations/
├── 0004_leagues.sql
└── 0005_matches_league_rls.sql
tests/
├── standings.test.ts
├── useLeagues.test.tsx
└── useLeagueMembers.test.tsx
```

---

### Task 1: Migrations — leagues, league_members, matches RLS update (USER RUNS SQL)

**Files:**
- Create: `supabase/migrations/0004_leagues.sql`
- Create: `supabase/migrations/0005_matches_league_rls.sql`

- [ ] **Step 1: Write leagues migration**

Create `supabase/migrations/0004_leagues.sql`:

```sql
-- Leagues
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index leagues_created_by_idx on public.leagues (created_by);

alter table public.leagues enable row level security;

-- League members (placeholder users get user_id = null until they sign up)
create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  seed_number int not null,
  name text not null,
  phone text,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (league_id, seed_number)
);

create index league_members_user_idx on public.league_members (user_id);
create index league_members_email_idx on public.league_members (email);

alter table public.league_members enable row level security;

-- Helper view for "am I a member of league X"
create or replace function public.is_league_member(p_league uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and user_id = auth.uid()
  );
$$;

-- League policies: members can see, only creator/admin can update/delete
create policy "leagues_select_if_member"
  on public.leagues for select
  to authenticated
  using (
    public.is_league_member(id) or created_by = auth.uid()
  );

create policy "leagues_insert_any_authenticated"
  on public.leagues for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "leagues_update_creator"
  on public.leagues for update
  to authenticated
  using (created_by = auth.uid());

create policy "leagues_delete_creator"
  on public.leagues for delete
  to authenticated
  using (created_by = auth.uid());

-- League members: anyone in the league sees the roster; only admins write
create policy "league_members_select_if_member"
  on public.league_members for select
  to authenticated
  using (
    public.is_league_member(league_id)
    or exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
  );

create policy "league_members_insert_admin"
  on public.league_members for insert
  to authenticated
  with check (
    exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
    or exists (
      select 1 from public.league_members
      where league_id = league_members.league_id and user_id = auth.uid() and role = 'admin'
    )
  );

create policy "league_members_update_admin"
  on public.league_members for update
  to authenticated
  using (
    exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
    or exists (
      select 1 from public.league_members lm2
      where lm2.league_id = league_members.league_id and lm2.user_id = auth.uid() and lm2.role = 'admin'
    )
  );

create policy "league_members_delete_admin"
  on public.league_members for delete
  to authenticated
  using (
    exists (select 1 from public.leagues l where l.id = league_id and l.created_by = auth.uid())
    or exists (
      select 1 from public.league_members lm2
      where lm2.league_id = league_members.league_id and lm2.user_id = auth.uid() and lm2.role = 'admin'
    )
  );

-- Trigger: link placeholder rows when a new user signs up with a matching email
create or replace function public.link_new_user_to_league_members()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.league_members
  set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_new_user_to_league_members();
```

- [ ] **Step 2: Write matches RLS update**

Create `supabase/migrations/0005_matches_league_rls.sql`:

```sql
-- Broaden matches policies: league members can read and write matches in their leagues.
-- Casual matches (league_id null) remain owner-only.

drop policy if exists "matches_owner_select" on public.matches;
drop policy if exists "matches_owner_insert" on public.matches;
drop policy if exists "matches_owner_update" on public.matches;
drop policy if exists "matches_owner_delete" on public.matches;

create policy "matches_select_owner_or_league"
  on public.matches for select to authenticated
  using (
    entered_by = auth.uid()
    or (league_id is not null and public.is_league_member(league_id))
  );

create policy "matches_insert_owner_or_league"
  on public.matches for insert to authenticated
  with check (
    entered_by = auth.uid()
    and (
      league_id is null
      or public.is_league_member(league_id)
    )
  );

create policy "matches_update_entered_by"
  on public.matches for update to authenticated
  using (entered_by = auth.uid());

create policy "matches_delete_entered_by"
  on public.matches for delete to authenticated
  using (entered_by = auth.uid());

-- Add FK constraint now that the leagues table exists
alter table public.matches
  add constraint matches_league_id_fk
  foreign key (league_id) references public.leagues(id) on delete set null;
```

- [ ] **Step 3: User applies migrations**

Open Supabase SQL Editor → run each in a fresh tab.

Expected: "Success. No rows returned." after each.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: leagues + league_members tables + matches league RLS"
```

---

### Task 2: scoring — leagueStandings function (TDD)

**Files:**
- Modify: `src/lib/scoring.ts`
- Create: `tests/standings.test.ts`

Add a function that computes the points table for a league given the members + matches.

- [ ] **Step 1: Write failing test**

Create `tests/standings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { leagueStandings, type LeagueMatchInput, type LeagueMemberInput } from '../src/lib/scoring'

const members: LeagueMemberInput[] = [
  { id: 'a', name: 'Alice', seed_number: 1 },
  { id: 'b', name: 'Bob', seed_number: 2 },
  { id: 'c', name: 'Carol', seed_number: 3 },
]

describe('leagueStandings', () => {
  it('returns all members with 0 points if no matches', () => {
    const s = leagueStandings(members, [])
    expect(s).toHaveLength(3)
    expect(s.every((m) => m.points === 0 && m.played === 0)).toBe(true)
  })

  it('awards 3 to match winner regardless of game count', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'b', player1_games: 2, player2_games: 0 },
      { player1_id: 'a', player2_id: 'c', player1_games: 2, player2_games: 1 },
    ]
    const s = leagueStandings(members, matches)
    const alice = s.find((x) => x.id === 'a')!
    expect(alice.wins).toBe(2)
    expect(alice.points).toBe(6)
  })

  it('gives 1 to loser when they took at least one game', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'b', player1_games: 2, player2_games: 1 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.find((x) => x.id === 'b')!.points).toBe(1)
  })

  it('gives 0 to loser when swept', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'b', player1_games: 2, player2_games: 0 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.find((x) => x.id === 'b')!.points).toBe(0)
  })

  it('sorts standings by points desc, then by name', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'b', player2_id: 'a', player1_games: 2, player2_games: 0 },
      { player1_id: 'b', player2_id: 'c', player1_games: 2, player2_games: 0 },
      { player1_id: 'c', player2_id: 'a', player1_games: 2, player2_games: 1 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('ignores matches with unknown member ids', () => {
    const matches: LeagueMatchInput[] = [
      { player1_id: 'a', player2_id: 'x-unknown', player1_games: 2, player2_games: 0 },
    ]
    const s = leagueStandings(members, matches)
    expect(s.find((x) => x.id === 'a')!.points).toBe(0)
    expect(s.find((x) => x.id === 'a')!.played).toBe(0)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- standings
```

- [ ] **Step 3: Implement in src/lib/scoring.ts**

Append to `src/lib/scoring.ts`:

```ts
export type LeagueMemberInput = {
  id: string
  name: string
  seed_number: number
}

export type LeagueMatchInput = {
  player1_id: string
  player2_id: string
  player1_games: number
  player2_games: number
}

export type LeagueStanding = {
  id: string
  name: string
  seed_number: number
  played: number
  wins: number
  losses: number
  points: number
}

export function leagueStandings(
  members: LeagueMemberInput[],
  matches: LeagueMatchInput[],
): LeagueStanding[] {
  const byId = new Map<string, LeagueStanding>()
  for (const m of members) {
    byId.set(m.id, {
      id: m.id,
      name: m.name,
      seed_number: m.seed_number,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
    })
  }

  for (const match of matches) {
    const p1 = byId.get(match.player1_id)
    const p2 = byId.get(match.player2_id)
    if (!p1 || !p2) continue
    if (match.player1_games === match.player2_games) continue

    const [pts1, pts2] = matchPoints(match.player1_games, match.player2_games)
    p1.played += 1
    p2.played += 1
    p1.points += pts1
    p2.points += pts2
    if (match.player1_games > match.player2_games) {
      p1.wins += 1
      p2.losses += 1
    } else {
      p2.wins += 1
      p1.losses += 1
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  )
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: leagueStandings derivation function"
```

---

### Task 3: useLeagues hook (TDD)

**Files:**
- Create: `src/leagues/useLeagues.ts`, `tests/useLeagues.test.tsx`

Hook responsibilities:
- `leagues` — array of leagues the current user is a member of (or created)
- `createLeague({name})` — inserts a league with `created_by = current user`, then inserts a `league_members` row for the creator with `seed_number=1, role='admin'`
- `loading`, `error`

- [ ] **Step 1: Test**

Create `tests/useLeagues.test.tsx`:

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useLeagues } from '../src/leagues/useLeagues'

const leagueInsert = vi.fn()
const memberInsert = vi.fn()

vi.mock('../src/lib/supabase', () => {
  const from = vi.fn((table: string) => {
    if (table === 'leagues') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [
          { id: 'L1', name: 'Thursday C', created_by: 'me', created_at: '' },
        ], error: null }) }),
        insert: (row: unknown) => {
          leagueInsert(row)
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'L2', ...(row as object) }, error: null }) }) }
        },
      }
    }
    if (table === 'league_members') {
      return {
        insert: (row: unknown) => { memberInsert(row); return Promise.resolve({ error: null }) },
      }
    }
    return {}
  })
  return {
    supabase: {
      from,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'me', email: 'me@example.com' } } }) },
    },
  }
})

describe('useLeagues', () => {
  beforeEach(() => { leagueInsert.mockReset(); memberInsert.mockReset() })

  it('loads leagues', async () => {
    const { result } = renderHook(() => useLeagues())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.leagues).toHaveLength(1)
    expect(result.current.leagues[0].name).toBe('Thursday C')
  })

  it('creates a league and adds creator as admin member', async () => {
    const { result } = renderHook(() => useLeagues())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.createLeague({ name: 'New League', creatorName: 'Jim' })
    })
    expect(leagueInsert).toHaveBeenCalledWith({ name: 'New League', created_by: 'me' })
    expect(memberInsert).toHaveBeenCalledWith(expect.objectContaining({
      league_id: 'L2',
      user_id: 'me',
      seed_number: 1,
      name: 'Jim',
      role: 'admin',
      email: 'me@example.com',
    }))
  })
})
```

- [ ] **Step 2: Implement**

Create `src/leagues/useLeagues.ts`:

```ts
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
    const { data, error } = await supabase.from('leagues').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setLeagues(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

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
```

- [ ] **Step 3: Run + commit**

```bash
npm test
git add .
git commit -m "feat: useLeagues hook"
```

---

### Task 4: useLeagueMembers hook (TDD)

**Files:**
- Create: `src/leagues/useLeagueMembers.ts`, `tests/useLeagueMembers.test.tsx`

Returns members for a given league, plus add/delete/update.

- [ ] **Step 1: Test**

Create `tests/useLeagueMembers.test.tsx`:

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useLeagueMembers } from '../src/leagues/useLeagueMembers'

const insert = vi.fn()
const del = vi.fn()
const eq = vi.fn()

vi.mock('../src/lib/supabase', () => {
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({ order: () => Promise.resolve({ data: [
        { id: 'M1', league_id: 'L1', user_id: null, seed_number: 1, name: 'Alice', phone: null, email: null, role: 'admin' },
      ], error: null }) }),
    }),
    insert: (row: unknown) => {
      insert(row)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'M2', ...(row as object) }, error: null }) }) }
    },
    delete: () => {
      del()
      return { eq: (...args: unknown[]) => { eq(...args); return Promise.resolve({ error: null }) } }
    },
  }))
  return { supabase: { from } }
})

describe('useLeagueMembers', () => {
  beforeEach(() => { insert.mockReset(); del.mockReset(); eq.mockReset() })

  it('loads members for the given league', async () => {
    const { result } = renderHook(() => useLeagueMembers('L1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.members).toHaveLength(1)
    expect(result.current.members[0].name).toBe('Alice')
  })

  it('inserts a new member', async () => {
    const { result } = renderHook(() => useLeagueMembers('L1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.addMember({ seed_number: 2, name: 'Bob', phone: '555', email: null })
    })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      league_id: 'L1', seed_number: 2, name: 'Bob', phone: '555',
    }))
  })

  it('deletes a member', async () => {
    const { result } = renderHook(() => useLeagueMembers('L1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.deleteMember('M1')
    })
    expect(eq).toHaveBeenCalledWith('id', 'M1')
  })
})
```

- [ ] **Step 2: Implement**

Create `src/leagues/useLeagueMembers.ts`:

```ts
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

  useEffect(() => { reload() }, [reload])

  const addMember = useCallback(async (input: NewMember) => {
    if (!leagueId) throw new Error('No league selected')
    const { data, error } = await supabase
      .from('league_members')
      .insert({ ...input, league_id: leagueId })
      .select()
      .single()
    if (error) throw error
    setMembers((prev) => [...prev, data as LeagueMember].sort((a, b) => a.seed_number - b.seed_number))
    return data as LeagueMember
  }, [leagueId])

  const deleteMember = useCallback(async (id: string) => {
    const { error } = await supabase.from('league_members').delete().eq('id', id)
    if (error) throw error
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return { members, loading, error, addMember, deleteMember, reload }
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test
git add .
git commit -m "feat: useLeagueMembers hook"
```

---

### Task 5: Leagues list + Create

**Files:**
- Create: `src/leagues/Leagues.tsx`, `src/leagues/CreateLeague.tsx`
- Modify: `src/screens/More.tsx` (add Leagues link)
- Modify: `src/shell/AppShell.tsx` (add /leagues route)

- [ ] **Step 1: Build CreateLeague**

Create `src/leagues/CreateLeague.tsx`:

```tsx
import { useState } from 'react'

export function CreateLeague({ onSubmit, onCancel, defaultName }: {
  onSubmit: (name: string, creatorName: string) => Promise<unknown>
  onCancel: () => void
  defaultName?: string
}) {
  const [name, setName] = useState('')
  const [creatorName, setCreatorName] = useState(defaultName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await onSubmit(name.trim(), creatorName.trim() || 'Me')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="bg-white rounded-2xl shadow p-4 space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <label className="block text-sm">
        League name
        <input value={name} onChange={(e) => setName(e.target.value)} required
          placeholder="e.g. Thursday C League"
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Your display name in this league
        <input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} required
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()}
          className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50">
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 rounded border border-slate-300 py-2 font-medium">Cancel</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Build Leagues list**

Create `src/leagues/Leagues.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLeagues } from './useLeagues'
import { CreateLeague } from './CreateLeague'

export function Leagues() {
  const { leagues, loading, createLeague } = useLeagues()
  const [creating, setCreating] = useState(false)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/more" className="text-emerald-300 text-sm">← More</Link>
        <h1 className="text-xl font-semibold">Leagues</h1>
        <span className="w-10" />
      </div>

      {creating ? (
        <CreateLeague
          onSubmit={async (name, creatorName) => {
            await createLeague({ name, creatorName })
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button onClick={() => setCreating(true)}
          className="w-full rounded bg-emerald-600 text-white py-2 font-medium">
          + Create league
        </button>
      )}

      {loading ? (
        <p className="text-sm text-slate-300">Loading…</p>
      ) : leagues.length === 0 ? (
        <p className="text-sm text-slate-300 text-center py-6">
          No leagues yet. Create one or wait for an invite.
        </p>
      ) : (
        <ul className="bg-white rounded-2xl shadow divide-y divide-slate-200">
          {leagues.map((l) => (
            <li key={l.id}>
              <Link to={`/leagues/${l.id}`} className="block p-3 font-medium">
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add Leagues link in More**

In `src/screens/More.tsx`, between Contacts and Sign out, insert:

```tsx
<Link to="/leagues" className="block bg-white rounded-2xl shadow p-4 font-medium">
  Leagues
</Link>
```

- [ ] **Step 4: Add route in AppShell**

Add: `import { Leagues } from '../leagues/Leagues'` and `<Route path="/leagues" element={<Leagues />} />`.

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add .
git commit -m "feat: leagues list + create"
```

---

### Task 6: League detail + roster + Standings

**Files:**
- Create: `src/leagues/League.tsx`, `src/leagues/MemberForm.tsx`, `src/leagues/Standings.tsx`
- Modify: `src/shell/AppShell.tsx` (add /leagues/:id route)

- [ ] **Step 1: Build MemberForm**

Create `src/leagues/MemberForm.tsx`:

```tsx
import { useState } from 'react'
import type { NewMember } from './useLeagueMembers'

export function MemberForm({ onSubmit, onCancel, defaultSeed }: {
  onSubmit: (input: NewMember) => Promise<unknown>
  onCancel: () => void
  defaultSeed: number
}) {
  const [seed, setSeed] = useState(defaultSeed)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await onSubmit({
        seed_number: seed,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="bg-white rounded-2xl shadow p-4 space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <label className="block text-sm w-20">
          Seed #
          <input type="number" min={1} value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-2" />
        </label>
        <label className="block text-sm flex-1">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        Phone (optional)
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm">
        Email (optional, lets them auto-join when they sign up)
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={saving || !name.trim()}
          className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50">
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 rounded border border-slate-300 py-2 font-medium">Cancel</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Build Standings**

Create `src/leagues/Standings.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { leagueStandings, type LeagueStanding } from '../lib/scoring'
import type { LeagueMember } from './useLeagueMembers'

export function Standings({ leagueId, members }: { leagueId: string; members: LeagueMember[] }) {
  const [rows, setRows] = useState<LeagueStanding[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('matches')
      .select('*')
      .eq('league_id', leagueId)
      .then(({ data }) => {
        if (!active) return
        // Each match links player1/player2 by either user_id or contact_id.
        // For leagues, players should be user-linked (matched to league_members.user_id).
        const memberByUser = new Map(members.filter((m) => m.user_id).map((m) => [m.user_id!, m]))
        const matchInputs = (data ?? [])
          .map((m) => {
            const p1 = m.player1_user_id ? memberByUser.get(m.player1_user_id) : undefined
            const p2 = m.player2_user_id ? memberByUser.get(m.player2_user_id) : undefined
            if (!p1 || !p2) return null
            return {
              player1_id: p1.id,
              player2_id: p2.id,
              player1_games: m.player1_games_won as number,
              player2_games: m.player2_games_won as number,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
        setRows(leagueStandings(
          members.map((m) => ({ id: m.id, name: m.name, seed_number: m.seed_number })),
          matchInputs,
        ))
        setLoading(false)
      })
    return () => { active = false }
  }, [leagueId, members])

  if (loading) return <div className="bg-white rounded-2xl shadow p-3 text-sm">Loading standings…</div>

  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">Standings</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs">
            <th className="text-left px-3 py-1">#</th>
            <th className="text-left px-3 py-1">Name</th>
            <th className="text-right px-3 py-1">P</th>
            <th className="text-right px-3 py-1">W-L</th>
            <th className="text-right px-3 py-1">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5">{i + 1}</td>
              <td className="px-3 py-1.5 font-medium">{r.name}</td>
              <td className="px-3 py-1.5 text-right">{r.played}</td>
              <td className="px-3 py-1.5 text-right">{r.wins}-{r.losses}</td>
              <td className="px-3 py-1.5 text-right font-semibold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Build League detail**

Create `src/leagues/League.tsx`:

```tsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useLeagues } from './useLeagues'
import { useLeagueMembers } from './useLeagueMembers'
import { MemberForm } from './MemberForm'
import { Standings } from './Standings'

export function League() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const { leagues } = useLeagues()
  const { members, loading, addMember, deleteMember } = useLeagueMembers(id ?? null)
  const [adding, setAdding] = useState(false)

  const league = leagues.find((l) => l.id === id)
  const myId = session?.user.id
  const isAdmin = !!(league && myId && league.created_by === myId)

  if (!id) return <div className="p-4">Invalid league</div>

  const nextSeed = members.length > 0 ? Math.max(...members.map((m) => m.seed_number)) + 1 : 1

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/leagues" className="text-emerald-300 text-sm">← Leagues</Link>
        <h1 className="text-xl font-semibold">{league?.name ?? 'League'}</h1>
        <span className="w-10" />
      </div>

      <Standings leagueId={id} members={members} />

      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b flex items-center justify-between">
          <span>Roster ({members.length})</span>
          {isAdmin && !adding && (
            <button onClick={() => setAdding(true)} className="text-emerald-700 text-sm">+ Add member</button>
          )}
        </div>

        {adding && (
          <div className="p-3">
            <MemberForm
              defaultSeed={nextSeed}
              onSubmit={async (input) => { await addMember(input); setAdding(false) }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {loading ? (
          <p className="p-3 text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="text-slate-400 w-6 inline-block">#{m.seed_number}</span>
                  <span className="font-medium">{m.name}</span>
                  {m.user_id == null && <span className="ml-2 text-xs text-slate-400">(invited)</span>}
                  {m.role === 'admin' && <span className="ml-2 text-xs text-emerald-700">admin</span>}
                </div>
                {isAdmin && m.user_id !== myId && (
                  <button
                    onClick={() => { if (confirm(`Remove ${m.name}?`)) deleteMember(m.id) }}
                    className="text-red-600 text-xs"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add /leagues/:id route**

In `src/shell/AppShell.tsx`, add: `import { League } from '../leagues/League'` and `<Route path="/leagues/:id" element={<League />} />`.

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add .
git commit -m "feat: league detail + roster + standings"
```

---

### Task 7: Log Match — optional league dropdown

**Files:**
- Modify: `src/matches/LogMatch.tsx`
- Modify: `src/matches/useMatches.ts`
- Modify: `tests/LogMatch.test.tsx` (loosen mocks)

When the user has at least one league, show a league selector. If picked, the match is logged with that `league_id` AND with `player2_user_id` (looking up the member's user_id) rather than `player2_contact_id`.

- [ ] **Step 1: Extend useMatches to accept league context**

In `src/matches/useMatches.ts`, broaden `NewMatchInput`:

```ts
export type NewMatchInput = {
  match_date: string
  league_id?: string | null
  opponent_contact_id?: string | null
  opponent_user_id?: string | null
  your_games: number
  their_games: number
  notes: string | null
}
```

And in `addMatch`, replace `league_id: null` with `league_id: input.league_id ?? null`.

- [ ] **Step 2: Add league + member fetch to LogMatch**

In `src/matches/LogMatch.tsx`:
- Import `useLeagues` and `useLeagueMembers`.
- Add state for `selectedLeague`.
- If `selectedLeague` set, fetch its members and show a member picker instead of the contact picker.
- When submitting with a league: pass `league_id` and `opponent_user_id` (the member's user_id, or null if placeholder — in which case we fall back to contact-based logging which won't work for leagues; warn the user the opponent must be a real user).

This is a UI change with branching logic — keep the contact-picker as fallback when no league is selected.

The minimum change: add a league dropdown above the opponent picker. If a league is chosen, swap the opponent picker to show that league's members (only those with `user_id != null`). Pass `league_id` and `opponent_user_id` to `addMatch`.

Adapt the existing LogMatch component to this. Aim for the smallest diff that works.

- [ ] **Step 3: Update LogMatch tests**

Since LogMatch now uses `useLeagues` and conditionally `useLeagueMembers`, mock both as returning empty arrays so the existing tests still describe the casual flow.

In `tests/LogMatch.test.tsx`, add:

```tsx
vi.mock('../src/leagues/useLeagues', () => ({
  useLeagues: () => ({ leagues: [], loading: false }),
}))

vi.mock('../src/leagues/useLeagueMembers', () => ({
  useLeagueMembers: () => ({ members: [], loading: false }),
}))
```

- [ ] **Step 4: Build + run tests + commit**

```bash
npm test
npm run build
git add .
git commit -m "feat: log match with optional league context"
```

---

### Task 8: Deploy + verify

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Manual smoke test on phone**

- More → Leagues → + Create league → "Thursday C League" + display name → Create
- Tap the league → roster shows you as admin with seed #1
- + Add member → add a couple of test members (with email to test auto-link later)
- Log → log a match
  - If you select the league, opponent picker becomes the league member list
  - Save → standings update

- [ ] **Step 3: Tag**

```bash
git tag plan-3-complete
git push --tags
```

---

## Self-Review

Coverage against the spec:
- ✅ leagues table + RLS (Task 1)
- ✅ league_members table + RLS + auto-link trigger (Task 1)
- ✅ matches RLS broadened for league members (Task 1)
- ✅ leagueStandings derivation (Task 2)
- ✅ useLeagues + useLeagueMembers hooks (Tasks 3, 4)
- ✅ Leagues list, create, detail with roster (Tasks 5, 6)
- ✅ Standings table per league (Task 6)
- ✅ Log Match supports league context (Task 7)
- ⏭ League schedule + Home this-week + SMS (Plan 4)
- ⏭ PDF parsing (Plan 5)

Known limitations after Plan 3:
- Members are added manually; no bulk import yet (Plan 5 PDF parsing will fix).
- Standings show 0 points until matches with league_id are recorded.
- A league match logged against a placeholder member (user_id null) currently can't happen because the picker filters to user-linked members only. Real-life flow: invite by email, they sign up, trigger links them, then they can play league matches.
