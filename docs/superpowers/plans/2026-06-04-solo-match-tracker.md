# Solo Match Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the personal match tracker — add contacts, log matches against them, see your record overall and head-to-head per opponent. No leagues yet; every match is "casual" (league_id null).

**Architecture:** Two new Postgres tables (`contacts`, `matches`) with owner-scoped RLS. Three new screens: Contacts (under More), Log Match (Log tab), Stats (Stats tab). Pure scoring functions in `lib/scoring.ts`. Data fetching via small hooks (`useContacts`, `useMatches`) that subscribe to changes.

**Tech Stack:** Same as Foundation — React + TS + Tailwind + Supabase + Vitest.

**Working directory:** `C:\Users\jim.h\OneDrive - Pine Pharmaceuticals\Desktop\racquetball-app`

---

## File Structure (end state)

```
src/
├── contacts/
│   ├── Contacts.tsx          # /contacts screen
│   ├── ContactForm.tsx       # add/edit form, used inline on Contacts
│   └── useContacts.ts        # list + CRUD hook
├── matches/
│   ├── LogMatch.tsx          # Log tab content
│   ├── OpponentPicker.tsx    # searchable dropdown of contacts
│   ├── MatchHistory.tsx      # list view used by Home + Stats
│   └── useMatches.ts         # list + insert hook
├── lib/
│   └── scoring.ts            # pure functions: matchPoints, summarizeHeadToHead
├── screens/
│   ├── Log.tsx               # renders <LogMatch />
│   ├── Stats.tsx             # renders <Stats />
│   ├── Stats/Stats.tsx       # overall + head-to-head view
│   └── More.tsx              # links to Contacts + profile/sign-out
supabase/migrations/
├── 0002_contacts.sql
└── 0003_matches.sql
tests/
├── scoring.test.ts
├── useContacts.test.tsx
├── LogMatch.test.tsx
└── Stats.test.tsx
```

---

### Task 1: Migrations — contacts + matches tables

**Files:**
- Create: `supabase/migrations/0002_contacts.sql`
- Create: `supabase/migrations/0003_matches.sql`

- [ ] **Step 1: Write contacts migration**

Create `supabase/migrations/0002_contacts.sql`:

```sql
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index contacts_owner_idx on public.contacts (owner_id);

alter table public.contacts enable row level security;

create policy "contacts_owner_all"
  on public.contacts for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

- [ ] **Step 2: Write matches migration**

Create `supabase/migrations/0003_matches.sql`:

```sql
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid,                    -- null = casual; FK added in Plan 3
  match_date date not null,
  player1_user_id uuid references auth.users(id) on delete set null,
  player1_contact_id uuid references public.contacts(id) on delete set null,
  player2_user_id uuid references auth.users(id) on delete set null,
  player2_contact_id uuid references public.contacts(id) on delete set null,
  player1_games_won smallint not null check (player1_games_won >= 0),
  player2_games_won smallint not null check (player2_games_won >= 0),
  notes text,
  entered_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_player1_exclusive check (
    (player1_user_id is not null)::int + (player1_contact_id is not null)::int = 1
  ),
  constraint matches_player2_exclusive check (
    (player2_user_id is not null)::int + (player2_contact_id is not null)::int = 1
  ),
  constraint matches_not_self check (
    player1_user_id is distinct from player2_user_id
    or player1_user_id is null
  ),
  constraint matches_no_draws check (player1_games_won <> player2_games_won)
);

create index matches_entered_by_idx on public.matches (entered_by);
create index matches_date_idx on public.matches (match_date desc);

alter table public.matches enable row level security;

-- For now (Plan 2, solo only): everyone sees / writes only their own matches.
-- Plan 3 will broaden this to include league members.
create policy "matches_owner_select"
  on public.matches for select
  to authenticated
  using (entered_by = auth.uid());

create policy "matches_owner_insert"
  on public.matches for insert
  to authenticated
  with check (entered_by = auth.uid());

create policy "matches_owner_update"
  on public.matches for update
  to authenticated
  using (entered_by = auth.uid());

create policy "matches_owner_delete"
  on public.matches for delete
  to authenticated
  using (entered_by = auth.uid());
```

- [ ] **Step 3: User applies both migrations**

In Supabase dashboard → SQL Editor → run each migration's SQL. Expected: "Success. No rows returned." after each.

Verify under Table Editor that `contacts` and `matches` exist with RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add contacts and matches table migrations"
```

---

### Task 2: scoring.ts (TDD)

**Files:**
- Create: `src/lib/scoring.ts`, `tests/scoring.test.ts`

Pure functions only — no React, no Supabase. The scoring rule from the spec:
- Match winner: 3 points (regardless of game count)
- Loser: 1 point if they won at least one game, 0 if swept

- [ ] **Step 1: Write failing test**

Create `tests/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchPoints, summarizeHeadToHead, type MatchSummary } from '../src/lib/scoring'

describe('matchPoints', () => {
  it('returns [3, 0] when player1 sweeps 2-0', () => {
    expect(matchPoints(2, 0)).toEqual([3, 0])
  })

  it('returns [3, 1] when player1 wins 2-1', () => {
    expect(matchPoints(2, 1)).toEqual([3, 1])
  })

  it('returns [0, 3] when player1 is swept 0-2', () => {
    expect(matchPoints(0, 2)).toEqual([0, 3])
  })

  it('returns [1, 3] when player1 loses 1-2', () => {
    expect(matchPoints(1, 2)).toEqual([1, 3])
  })

  it('throws on a tie', () => {
    expect(() => matchPoints(1, 1)).toThrow(/tie|draw/i)
  })
})

describe('summarizeHeadToHead', () => {
  const me = 'user-me'
  const bob = 'opponent-bob'
  const sue = 'opponent-sue'

  const matches: MatchSummary[] = [
    { youWon: true, opponentId: bob, opponentName: 'Bob', yourGames: 2, theirGames: 0 },
    { youWon: true, opponentId: bob, opponentName: 'Bob', yourGames: 2, theirGames: 1 },
    { youWon: false, opponentId: bob, opponentName: 'Bob', yourGames: 1, theirGames: 2 },
    { youWon: true, opponentId: sue, opponentName: 'Sue', yourGames: 2, theirGames: 0 },
  ]

  it('returns overall W-L', () => {
    const { overall } = summarizeHeadToHead(matches, me)
    expect(overall).toEqual({ wins: 3, losses: 1, played: 4 })
  })

  it('returns per-opponent record', () => {
    const { perOpponent } = summarizeHeadToHead(matches, me)
    expect(perOpponent).toEqual([
      { opponentId: bob, opponentName: 'Bob', wins: 2, losses: 1, played: 3 },
      { opponentId: sue, opponentName: 'Sue', wins: 1, losses: 0, played: 1 },
    ])
  })

  it('sorts opponents by most played', () => {
    const { perOpponent } = summarizeHeadToHead(matches, me)
    expect(perOpponent[0].opponentName).toBe('Bob')
  })

  it('handles empty input', () => {
    const { overall, perOpponent } = summarizeHeadToHead([], me)
    expect(overall).toEqual({ wins: 0, losses: 0, played: 0 })
    expect(perOpponent).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- scoring
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `src/lib/scoring.ts`:

```ts
export type Points = [number, number]

export function matchPoints(p1Games: number, p2Games: number): Points {
  if (p1Games === p2Games) {
    throw new Error('Ties are not allowed in racquetball matches')
  }
  const p1Won = p1Games > p2Games
  return p1Won ? [3, p2Games > 0 ? 1 : 0] : [p1Games > 0 ? 1 : 0, 3]
}

export type MatchSummary = {
  youWon: boolean
  opponentId: string
  opponentName: string
  yourGames: number
  theirGames: number
}

export type Record = { wins: number; losses: number; played: number }

export type HeadToHead = {
  overall: Record
  perOpponent: Array<Record & { opponentId: string; opponentName: string }>
}

export function summarizeHeadToHead(matches: MatchSummary[], _userId: string): HeadToHead {
  const overall: Record = { wins: 0, losses: 0, played: 0 }
  const byOpponent = new Map<string, Record & { opponentName: string }>()

  for (const m of matches) {
    overall.played += 1
    if (m.youWon) overall.wins += 1
    else overall.losses += 1

    const existing = byOpponent.get(m.opponentId) ?? {
      opponentName: m.opponentName,
      wins: 0,
      losses: 0,
      played: 0,
    }
    existing.played += 1
    if (m.youWon) existing.wins += 1
    else existing.losses += 1
    byOpponent.set(m.opponentId, existing)
  }

  const perOpponent = Array.from(byOpponent.entries())
    .map(([opponentId, r]) => ({ opponentId, ...r }))
    .sort((a, b) => b.played - a.played || a.opponentName.localeCompare(b.opponentName))

  return { overall, perOpponent }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- scoring
```

Expected: 9 scoring tests pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: scoring derivation functions"
```

---

### Task 3: useContacts hook (TDD)

**Files:**
- Create: `src/contacts/useContacts.ts`, `tests/useContacts.test.tsx`

The hook returns `{ contacts, loading, addContact, deleteContact }` and subscribes to changes from Supabase realtime.

- [ ] **Step 1: Write failing test**

Create `tests/useContacts.test.tsx`:

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useContacts } from '../src/contacts/useContacts'

const select = vi.fn()
const insert = vi.fn()
const del = vi.fn()
const eq = vi.fn()

vi.mock('../src/lib/supabase', () => {
  const from = vi.fn(() => ({
    select: (...args: unknown[]) => {
      select(...args)
      return {
        order: () => Promise.resolve({ data: [
          { id: '1', name: 'Bob', phone: '555-1234', owner_id: 'me' },
          { id: '2', name: 'Sue', phone: null, owner_id: 'me' },
        ], error: null }),
      }
    },
    insert: (rows: unknown) => {
      insert(rows)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: '3', name: 'Joe', phone: null, owner_id: 'me' }, error: null }) }) }
    },
    delete: () => {
      del()
      return { eq: (...args: unknown[]) => { eq(...args); return Promise.resolve({ error: null }) } }
    },
  }))
  return {
    supabase: {
      from,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'me' } } }) },
    },
  }
})

describe('useContacts', () => {
  beforeEach(() => { select.mockReset(); insert.mockReset(); del.mockReset(); eq.mockReset() })

  it('loads contacts on mount', async () => {
    const { result } = renderHook(() => useContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.contacts).toHaveLength(2)
    expect(result.current.contacts[0].name).toBe('Bob')
  })

  it('inserts a new contact', async () => {
    const { result } = renderHook(() => useContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.addContact({ name: 'Joe', phone: null })
    })
    expect(insert).toHaveBeenCalledWith({ name: 'Joe', phone: null, owner_id: 'me' })
  })

  it('deletes a contact', async () => {
    const { result } = renderHook(() => useContacts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.deleteContact('1')
    })
    expect(eq).toHaveBeenCalledWith('id', '1')
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- useContacts
```

- [ ] **Step 3: Implement**

Create `src/contacts/useContacts.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Contact = {
  id: string
  owner_id: string
  name: string
  phone: string | null
  linked_user_id?: string | null
  created_at?: string
}

export type NewContact = { name: string; phone: string | null }

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('contacts').select('*').order('name')
    if (error) setError(error.message)
    else setContacts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const addContact = useCallback(async (input: NewContact) => {
    const { data: u } = await supabase.auth.getUser()
    const owner_id = u.user?.id
    if (!owner_id) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...input, owner_id })
      .select()
      .single()
    if (error) throw error
    setContacts((prev) => [...prev, data as Contact].sort((a, b) => a.name.localeCompare(b.name)))
    return data as Contact
  }, [])

  const deleteContact = useCallback(async (id: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { contacts, loading, error, addContact, deleteContact, reload }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- useContacts
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: useContacts hook"
```

---

### Task 4: Contacts screen

**Files:**
- Create: `src/contacts/Contacts.tsx`, `src/contacts/ContactForm.tsx`
- Modify: `src/screens/More.tsx`, `src/shell/AppShell.tsx` (add /contacts route)

- [ ] **Step 1: Build ContactForm**

Create `src/contacts/ContactForm.tsx`:

```tsx
import { useState } from 'react'
import type { NewContact } from './useContacts'

export function ContactForm({ onSubmit, onCancel }: {
  onSubmit: (input: NewContact) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim() || null })
      setName('')
      setPhone('')
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded-2xl shadow">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <label className="block text-sm">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Phone (optional)
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded border border-slate-300 py-2 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Build Contacts screen**

Create `src/contacts/Contacts.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useContacts } from './useContacts'
import { ContactForm } from './ContactForm'

export function Contacts() {
  const { contacts, loading, addContact, deleteContact } = useContacts()
  const [adding, setAdding] = useState(false)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/more" className="text-emerald-700 text-sm">← More</Link>
        <h1 className="text-xl font-semibold">Contacts</h1>
        <span className="w-10" />
      </div>

      {adding ? (
        <ContactForm onSubmit={addContact} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded bg-emerald-600 text-white py-2 font-medium"
        >
          + Add contact
        </button>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No contacts yet.</p>
      ) : (
        <ul className="bg-white rounded-2xl shadow divide-y divide-slate-200">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{c.name}</div>
                {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete ${c.name}?`)) deleteContact(c.id)
                }}
                className="text-sm text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route in AppShell**

Modify `src/shell/AppShell.tsx`. Read it first to confirm current state, then add the new import and route.

Add import: `import { Contacts } from '../contacts/Contacts'`

Add route inside `<Routes>`: `<Route path="/contacts" element={<Contacts />} />` (anywhere before the catch-all `*`).

- [ ] **Step 4: Replace placeholder More.tsx**

Overwrite `src/screens/More.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function More() {
  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-semibold mb-4">More</h1>
      <Link
        to="/contacts"
        className="block bg-white rounded-2xl shadow p-4 font-medium"
      >
        Contacts
      </Link>
      <button
        onClick={signOut}
        className="block w-full text-left bg-white rounded-2xl shadow p-4 font-medium text-red-600"
      >
        Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Sign in → tap More → tap Contacts → add "Bob" with phone "555-1234" → save. List should show Bob. Tap Delete, confirm.

- [ ] **Step 6: Build check**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: contacts screen + add/delete + sign out in More"
```

---

### Task 5: useMatches hook (TDD)

**Files:**
- Create: `src/matches/useMatches.ts`, `tests/useMatches.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/useMatches.test.tsx`:

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useMatches } from '../src/matches/useMatches'

const insertCalls = vi.fn()
const orderSpy = vi.fn()

vi.mock('../src/lib/supabase', () => {
  const from = vi.fn(() => ({
    select: () => ({
      order: (...args: unknown[]) => {
        orderSpy(...args)
        return Promise.resolve({
          data: [
            {
              id: 'm1',
              match_date: '2026-06-01',
              player1_user_id: 'me',
              player1_contact_id: null,
              player2_user_id: null,
              player2_contact_id: 'c-bob',
              player1_games_won: 2,
              player2_games_won: 0,
              notes: null,
              league_id: null,
              entered_by: 'me',
              created_at: '2026-06-01T00:00:00Z',
            },
          ],
          error: null,
        })
      },
    }),
    insert: (row: unknown) => {
      insertCalls(row)
      return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new', ...(row as object) }, error: null }) }) }
    },
  }))
  return {
    supabase: {
      from,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'me' } } }) },
    },
  }
})

describe('useMatches', () => {
  beforeEach(() => { insertCalls.mockReset(); orderSpy.mockReset() })

  it('loads matches on mount, newest first', async () => {
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.matches).toHaveLength(1)
    expect(orderSpy).toHaveBeenCalledWith('match_date', { ascending: false })
  })

  it('inserts a new match', async () => {
    const { result } = renderHook(() => useMatches())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.addMatch({
        match_date: '2026-06-04',
        opponent_contact_id: 'c-bob',
        your_games: 2,
        their_games: 1,
        notes: null,
      })
    })
    expect(insertCalls).toHaveBeenCalledWith(expect.objectContaining({
      match_date: '2026-06-04',
      player1_user_id: 'me',
      player1_contact_id: null,
      player2_user_id: null,
      player2_contact_id: 'c-bob',
      player1_games_won: 2,
      player2_games_won: 1,
      entered_by: 'me',
    }))
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- useMatches
```

- [ ] **Step 3: Implement**

Create `src/matches/useMatches.ts`:

```ts
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
      league_id: null,
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
```

- [ ] **Step 4: Run tests — expect pass**

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: useMatches hook"
```

---

### Task 6: Log Match screen

**Files:**
- Create: `src/matches/LogMatch.tsx`, `src/matches/OpponentPicker.tsx`, `tests/LogMatch.test.tsx`
- Modify: `src/screens/Log.tsx`

- [ ] **Step 1: Build OpponentPicker**

Create `src/matches/OpponentPicker.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type { Contact } from '../contacts/useContacts'

export function OpponentPicker({ contacts, value, onChange }: {
  contacts: Contact[]
  value: string | null
  onChange: (contactId: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const selected = contacts.find((c) => c.id === value)

  const filtered = useMemo(() => {
    if (!query) return contacts
    const q = query.toLowerCase()
    return contacts.filter((c) => c.name.toLowerCase().includes(q))
  }, [contacts, query])

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-white border border-slate-300 rounded px-3 py-2">
        <span>{selected.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-sm text-emerald-700"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search contacts…"
        className="block w-full rounded border border-slate-300 px-3 py-2"
      />
      {filtered.length > 0 && (
        <ul className="mt-2 bg-white border border-slate-200 rounded divide-y divide-slate-100 max-h-48 overflow-auto">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onChange(c.id); setQuery('') }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered.length === 0 && contacts.length > 0 && (
        <p className="text-sm text-slate-500 mt-2">No match. Try a different name.</p>
      )}
      {contacts.length === 0 && (
        <p className="text-sm text-slate-500 mt-2">No contacts yet — add one from the More tab.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build LogMatch**

Create `src/matches/LogMatch.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../contacts/useContacts'
import { useMatches } from './useMatches'
import { OpponentPicker } from './OpponentPicker'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function LogMatch() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [opponentId, setOpponentId] = useState<string | null>(null)
  const [yourGames, setYourGames] = useState<number>(2)
  const [theirGames, setTheirGames] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!opponentId) {
      setError('Pick an opponent first.')
      return
    }
    if (yourGames === theirGames) {
      setError('Ties are not allowed.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addMatch({
        match_date: date,
        opponent_contact_id: opponentId,
        your_games: yourGames,
        their_games: theirGames,
        notes: notes.trim() || null,
      })
      navigate('/stats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Log Match</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <div>
          <span className="block text-sm mb-1">Opponent</span>
          {contactsLoading ? (
            <p className="text-sm text-slate-500">Loading contacts…</p>
          ) : (
            <OpponentPicker contacts={contacts} value={opponentId} onChange={setOpponentId} />
          )}
        </div>

        <div className="flex gap-3">
          <label className="flex-1 text-sm">
            Your games
            <input
              type="number"
              min={0}
              max={3}
              value={yourGames}
              onChange={(e) => setYourGames(Number(e.target.value))}
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex-1 text-sm">
            Their games
            <input
              type="number"
              min={0}
              max={3}
              value={theirGames}
              onChange={(e) => setTheirGames(Number(e.target.value))}
              required
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={saving || !opponentId}
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Replace Log.tsx**

Overwrite `src/screens/Log.tsx`:

```tsx
import { LogMatch } from '../matches/LogMatch'

export function Log() {
  return <LogMatch />
}
```

- [ ] **Step 4: Write tests**

Create `tests/LogMatch.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LogMatch } from '../src/matches/LogMatch'

const addMatch = vi.fn()

vi.mock('../src/matches/useMatches', () => ({
  useMatches: () => ({ addMatch, matches: [], loading: false }),
}))

vi.mock('../src/contacts/useContacts', () => ({
  useContacts: () => ({
    contacts: [
      { id: 'c-bob', owner_id: 'me', name: 'Bob', phone: null },
      { id: 'c-sue', owner_id: 'me', name: 'Sue', phone: null },
    ],
    loading: false,
  }),
}))

function renderUi() {
  return render(<MemoryRouter><LogMatch /></MemoryRouter>)
}

describe('LogMatch', () => {
  beforeEach(() => { addMatch.mockReset().mockResolvedValue({ id: 'new' }) })

  it('refuses to submit without an opponent', async () => {
    renderUi()
    expect(screen.getByRole('button', { name: /save match/i })).toBeDisabled()
  })

  it('rejects a tie score', async () => {
    renderUi()
    await userEvent.click(screen.getByPlaceholderText(/search contacts/i))
    await userEvent.click(screen.getByText('Bob'))
    const [yours, theirs] = screen.getAllByRole('spinbutton')
    await userEvent.clear(yours); await userEvent.type(yours, '1')
    await userEvent.clear(theirs); await userEvent.type(theirs, '1')
    await userEvent.click(screen.getByRole('button', { name: /save match/i }))
    expect(await screen.findByText(/ties are not allowed/i)).toBeInTheDocument()
    expect(addMatch).not.toHaveBeenCalled()
  })

  it('submits a valid match', async () => {
    renderUi()
    await userEvent.click(screen.getByPlaceholderText(/search contacts/i))
    await userEvent.click(screen.getByText('Bob'))
    await userEvent.click(screen.getByRole('button', { name: /save match/i }))
    expect(addMatch).toHaveBeenCalledWith(expect.objectContaining({
      opponent_contact_id: 'c-bob',
      your_games: 2,
      their_games: 0,
    }))
  })
})
```

- [ ] **Step 5: Run tests + build**

```bash
npm test
npm run build
```

Expected: all tests pass, clean build.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: log match screen with opponent picker"
```

---

### Task 7: Stats screen

**Files:**
- Create: `src/matches/Stats.tsx`, `src/matches/MatchHistory.tsx`, `tests/Stats.test.tsx`
- Modify: `src/screens/Stats.tsx`

- [ ] **Step 1: Build MatchHistory component**

Create `src/matches/MatchHistory.tsx`:

```tsx
import type { Match } from './useMatches'
import type { Contact } from '../contacts/useContacts'

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
        const youArePlayer1 = m.player1_user_id === userId
        const yourGames = youArePlayer1 ? m.player1_games_won : m.player2_games_won
        const theirGames = youArePlayer1 ? m.player2_games_won : m.player1_games_won
        const oppContactId = youArePlayer1 ? m.player2_contact_id : m.player1_contact_id
        const oppName = oppContactId ? contactsById.get(oppContactId)?.name ?? '(deleted)' : '(unknown)'
        const won = yourGames > theirGames
        return (
          <li key={m.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">{m.match_date}</div>
              <div className="font-medium">vs {oppName}</div>
            </div>
            <div className={`font-semibold ${won ? 'text-emerald-600' : 'text-slate-500'}`}>
              {won ? 'W' : 'L'} {yourGames}–{theirGames}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Build Stats**

Create `src/matches/Stats.tsx`:

```tsx
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
```

- [ ] **Step 3: Replace screens/Stats.tsx**

Overwrite `src/screens/Stats.tsx`:

```tsx
import { Stats as StatsView } from '../matches/Stats'

export function Stats() {
  return <StatsView />
}
```

- [ ] **Step 4: Write tests**

Create `tests/Stats.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Stats } from '../src/matches/Stats'

const myId = 'user-me'

vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: myId } }, loading: false }),
}))

vi.mock('../src/contacts/useContacts', () => ({
  useContacts: () => ({
    contacts: [{ id: 'c-bob', owner_id: myId, name: 'Bob', phone: null }],
    loading: false,
  }),
}))

vi.mock('../src/matches/useMatches', () => ({
  useMatches: () => ({
    matches: [
      {
        id: 'm1', league_id: null, match_date: '2026-06-01',
        player1_user_id: myId, player1_contact_id: null,
        player2_user_id: null, player2_contact_id: 'c-bob',
        player1_games_won: 2, player2_games_won: 0,
        notes: null, entered_by: myId, created_at: '',
      },
      {
        id: 'm2', league_id: null, match_date: '2026-05-25',
        player1_user_id: myId, player1_contact_id: null,
        player2_user_id: null, player2_contact_id: 'c-bob',
        player1_games_won: 1, player2_games_won: 2,
        notes: null, entered_by: myId, created_at: '',
      },
    ],
    loading: false,
  }),
}))

describe('Stats', () => {
  it('shows overall W-L', async () => {
    render(<Stats />)
    expect(await screen.findByText('1–1')).toBeInTheDocument()
  })

  it('shows per-opponent record', async () => {
    render(<Stats />)
    expect(await screen.findByText('Bob')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run tests + build**

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: stats screen with overall + head-to-head + recent matches"
```

---

### Task 8: Home tab shows recent matches

**Files:**
- Modify: `src/screens/Home.tsx`

The Home tab currently shows just "Home". Add a record card + recent matches so Home is useful even before leagues exist.

- [ ] **Step 1: Build Home**

Overwrite `src/screens/Home.tsx`:

```tsx
import { useAuth } from '../auth/useAuth'
import { useContacts } from '../contacts/useContacts'
import { useMatches } from '../matches/useMatches'
import { MatchHistory } from '../matches/MatchHistory'

export function Home() {
  const { session } = useAuth()
  const { matches, loading: matchesLoading } = useMatches()
  const { contacts } = useContacts()
  const userId = session?.user.id

  if (!userId || matchesLoading) return <div className="p-4">Loading…</div>

  const contactsById = new Map(contacts.map((c) => [c.id, c]))
  const wins = matches.filter((m) =>
    (m.player1_user_id === userId ? m.player1_games_won : m.player2_games_won) >
    (m.player1_user_id === userId ? m.player2_games_won : m.player1_games_won)
  ).length
  const losses = matches.length - wins

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="text-sm text-slate-500">Your record</div>
        <div className="text-3xl font-bold">{wins}–{losses}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-600 mb-1">Recent matches</div>
        <MatchHistory matches={matches.slice(0, 5)} contactsById={contactsById} userId={userId} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: home tab shows record + recent matches"
```

---

### Task 9: Deploy and verify

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

Vercel auto-deploys. CI runs on the push.

- [ ] **Step 2: Smoke test on phone**

- Open the app on your phone (refresh if installed as PWA).
- Tap More → Contacts → add 2-3 people you actually play.
- Tap Log → record a recent match.
- Tap Stats → confirm overall W-L and head-to-head show correctly.
- Tap Home → confirm the record card and recent matches show.

- [ ] **Step 3: Tag the milestone**

```bash
git tag plan-2-complete
git push --tags
```

---

## Self-Review

Coverage against the design spec:

- ✅ Contacts table + RLS (Task 1)
- ✅ Matches table + RLS, constraints (Task 1)
- ✅ Scoring rule (Task 2)
- ✅ Contacts CRUD (Tasks 3, 4)
- ✅ Log Match screen with opponent picker (Tasks 5, 6)
- ✅ Stats: overall + head-to-head (Task 7)
- ✅ Home tab shows record + recent matches (Task 8)
- ⏭ Sign-out (added to More in Task 4 as a bonus — needed for testing different accounts)

Out of scope (deferred to later plans):
- Leagues, league members, standings (Plan 3)
- League schedule + Home "this week" + SMS (Plan 4)
- PDF parsing (Plan 5)
- Match editing/deletion (defer — re-log if you typo; Plan 3+ can add)
- Realtime updates across devices (the hooks reload on user action only)

Constraints / known issues:
- `matches_not_self` constraint allows null user vs null user (since it uses `is distinct from`). That's fine — in solo, player1 is always a user and player2 is always a contact.
- Match history filters out league matches in Stats only by including matches where the user is a player. Plan 3 will distinguish league vs casual filtering.
