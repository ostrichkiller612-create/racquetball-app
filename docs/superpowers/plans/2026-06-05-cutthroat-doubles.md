# Cutthroat & Doubles Match Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cutthroat (3 players) and doubles (4 players in 2 teams) as match types in Log Match, recorded as casual-only matches that count toward overall W-L but not toward head-to-head or league standings.

**Architecture:** One migration extends the `matches` table with `match_type`, `player3_*`, `player4_*`, and `winner_position` columns plus reworked check constraints. `NewMatchInput` becomes a tagged union (`type: 'singles' | 'cutthroat' | 'doubles'`). Logic that maps each variant to a DB row is extracted into a pure `buildMatchRow` for testability. Log Match screen gets a type-toggle pill and three sub-forms.

**Tech Stack:** Same as the rest of the app — React + TS + Tailwind + Supabase + Vitest.

**Working directory:** `C:\Users\jim.h\OneDrive - Pine Pharmaceuticals\Desktop\racquetball-app`

---

## File Structure (end state)

```
src/
├── matches/
│   ├── LogMatch.tsx          # MODIFIED: type-toggle + conditional sub-form
│   ├── LogSingles.tsx        # NEW: extracted from current LogMatch body
│   ├── LogCutthroat.tsx      # NEW
│   ├── LogDoubles.tsx        # NEW
│   ├── MatchHistory.tsx      # MODIFIED: dispatches on match_type
│   ├── buildMatchRow.ts      # NEW: pure NewMatchInput -> DB row
│   └── useMatches.ts         # MODIFIED: NewMatchInput union + addMatch delegates to buildMatchRow
├── lib/
│   └── scoring.ts            # MODIFIED: append didIWin(match, userId)
├── matches/Stats.tsx         # MODIFIED: H2H filter, overall counts via didIWin
supabase/migrations/
└── 0007_match_types.sql      # NEW
tests/
├── didIWin.test.ts           # NEW
├── buildMatchRow.test.ts     # NEW
├── LogMatch.test.tsx         # MODIFIED: keep existing singles tests
```

---

### Task 1: Migration — extend matches table

**Files:**
- Create: `supabase/migrations/0007_match_types.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0007_match_types.sql`:

```sql
-- Add columns
alter table public.matches
  add column match_type text not null default 'singles'
    check (match_type in ('singles', 'cutthroat', 'doubles')),
  add column player3_user_id uuid references auth.users(id) on delete set null,
  add column player3_contact_id uuid references public.contacts(id) on delete set null,
  add column player4_user_id uuid references auth.users(id) on delete set null,
  add column player4_contact_id uuid references public.contacts(id) on delete set null,
  add column winner_position smallint;

-- Drop the singles-only check constraints; replace with format-aware versions
alter table public.matches
  drop constraint if exists matches_player1_exclusive,
  drop constraint if exists matches_player2_exclusive,
  drop constraint if exists matches_not_self,
  drop constraint if exists matches_no_draws;

alter table public.matches
  add constraint matches_player1_xor
    check ((player1_user_id is not null)::int + (player1_contact_id is not null)::int = 1),
  add constraint matches_player2_xor
    check ((player2_user_id is not null)::int + (player2_contact_id is not null)::int = 1),
  add constraint matches_player3_xor
    check (
      match_type = 'singles'
      or (player3_user_id is not null)::int + (player3_contact_id is not null)::int = 1
    ),
  add constraint matches_player4_xor
    check (
      match_type in ('singles', 'cutthroat')
      or (player4_user_id is not null)::int + (player4_contact_id is not null)::int = 1
    );

alter table public.matches
  add constraint matches_singles_rules check (
    match_type <> 'singles'
    or (
      player3_user_id is null and player3_contact_id is null
      and player4_user_id is null and player4_contact_id is null
      and winner_position is null
      and player1_games_won <> player2_games_won
    )
  ),
  add constraint matches_cutthroat_rules check (
    match_type <> 'cutthroat'
    or (
      player4_user_id is null and player4_contact_id is null
      and winner_position in (1, 2, 3)
      and league_id is null
    )
  ),
  add constraint matches_doubles_rules check (
    match_type <> 'doubles'
    or (
      winner_position in (1, 2)
      and league_id is null
    )
  );
```

- [ ] **Step 2: User applies migration in Supabase SQL Editor**

Run the SQL block above. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify** the existing matches table now has the new columns by checking Table Editor → `matches`. All existing rows should still have `match_type = 'singles'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: matches table supports cutthroat + doubles"
```

---

### Task 2: didIWin pure function (TDD)

**Files:**
- Modify: `src/lib/scoring.ts` (append at bottom)
- Create: `tests/didIWin.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/didIWin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { didIWin } from '../src/lib/scoring'
import type { Match } from '../src/matches/useMatches'

const me = 'user-me'

function makeSingles(p1: string, p2: string, p1Games: number, p2Games: number): Match {
  return {
    id: 'm', league_id: null, match_date: '2026-06-05',
    match_type: 'singles',
    player1_user_id: p1, player1_contact_id: null,
    player2_user_id: p2, player2_contact_id: null,
    player3_user_id: null, player3_contact_id: null,
    player4_user_id: null, player4_contact_id: null,
    player1_games_won: p1Games, player2_games_won: p2Games,
    winner_position: null, notes: null,
    entered_by: 'me', created_at: '',
  }
}

function makeCutthroat(positions: [string, string, string], winnerPos: 1 | 2 | 3): Match {
  return {
    id: 'm', league_id: null, match_date: '2026-06-05',
    match_type: 'cutthroat',
    player1_user_id: positions[0], player1_contact_id: null,
    player2_user_id: positions[1], player2_contact_id: null,
    player3_user_id: positions[2], player3_contact_id: null,
    player4_user_id: null, player4_contact_id: null,
    player1_games_won: 0, player2_games_won: 0,
    winner_position: winnerPos, notes: null,
    entered_by: 'me', created_at: '',
  }
}

function makeDoubles(positions: [string, string, string, string], winningTeam: 1 | 2): Match {
  return {
    id: 'm', league_id: null, match_date: '2026-06-05',
    match_type: 'doubles',
    player1_user_id: positions[0], player1_contact_id: null,
    player2_user_id: positions[1], player2_contact_id: null,
    player3_user_id: positions[2], player3_contact_id: null,
    player4_user_id: positions[3], player4_contact_id: null,
    player1_games_won: 0, player2_games_won: 0,
    winner_position: winningTeam, notes: null,
    entered_by: 'me', created_at: '',
  }
}

describe('didIWin', () => {
  describe('singles', () => {
    it('returns true when I am player1 and won', () => {
      expect(didIWin(makeSingles(me, 'opp', 2, 0), me)).toBe(true)
    })
    it('returns true when I am player2 and won', () => {
      expect(didIWin(makeSingles('opp', me, 0, 2), me)).toBe(true)
    })
    it('returns false when I lost', () => {
      expect(didIWin(makeSingles(me, 'opp', 1, 2), me)).toBe(false)
    })
    it('returns false when I was not in the match', () => {
      expect(didIWin(makeSingles('a', 'b', 2, 0), me)).toBe(false)
    })
  })

  describe('cutthroat', () => {
    it('returns true when I am position 1 and won', () => {
      expect(didIWin(makeCutthroat([me, 'b', 'c'], 1), me)).toBe(true)
    })
    it('returns true when I am position 2 and won', () => {
      expect(didIWin(makeCutthroat(['a', me, 'c'], 2), me)).toBe(true)
    })
    it('returns true when I am position 3 and won', () => {
      expect(didIWin(makeCutthroat(['a', 'b', me], 3), me)).toBe(true)
    })
    it('returns false when someone else won', () => {
      expect(didIWin(makeCutthroat([me, 'b', 'c'], 2), me)).toBe(false)
    })
    it('returns false when I was not in the match', () => {
      expect(didIWin(makeCutthroat(['a', 'b', 'c'], 1), me)).toBe(false)
    })
  })

  describe('doubles', () => {
    it('returns true when I am on the winning team (slot 1)', () => {
      expect(didIWin(makeDoubles([me, 'partner', 'opp1', 'opp2'], 1), me)).toBe(true)
    })
    it('returns true when I am on the winning team (slot 2)', () => {
      expect(didIWin(makeDoubles(['partner', me, 'opp1', 'opp2'], 1), me)).toBe(true)
    })
    it('returns true when I am on team 2 and team 2 won', () => {
      expect(didIWin(makeDoubles(['a', 'b', me, 'partner'], 2), me)).toBe(true)
    })
    it('returns false when I am on the losing team', () => {
      expect(didIWin(makeDoubles([me, 'partner', 'opp1', 'opp2'], 2), me)).toBe(false)
    })
    it('returns false when I was not in the match', () => {
      expect(didIWin(makeDoubles(['a', 'b', 'c', 'd'], 1), me)).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- didIWin
```

Expected: FAIL — `Match` type doesn't yet include the new fields, and `didIWin` doesn't exist.

(If TypeScript blocks the test from compiling because of missing fields on `Match`, that's OK — fix in Step 3 by updating the `Match` type first.)

- [ ] **Step 3: Update Match type in src/matches/useMatches.ts**

Modify the `Match` type to include the new fields. Find the existing `export type Match = { ... }` block and replace it with:

```ts
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
```

- [ ] **Step 4: Append didIWin to src/lib/scoring.ts**

Read the existing file, then append at the bottom:

```ts
import type { Match } from '../matches/useMatches'

export function didIWin(match: Match, userId: string): boolean {
  if (match.match_type === 'singles') {
    if (match.player1_user_id === userId) {
      return match.player1_games_won > match.player2_games_won
    }
    if (match.player2_user_id === userId) {
      return match.player2_games_won > match.player1_games_won
    }
    return false
  }
  if (match.match_type === 'cutthroat') {
    const myPos =
      match.player1_user_id === userId ? 1
      : match.player2_user_id === userId ? 2
      : match.player3_user_id === userId ? 3
      : null
    return myPos !== null && match.winner_position === myPos
  }
  if (match.match_type === 'doubles') {
    const myTeam =
      match.player1_user_id === userId || match.player2_user_id === userId ? 1
      : match.player3_user_id === userId || match.player4_user_id === userId ? 2
      : null
    return myTeam !== null && match.winner_position === myTeam
  }
  return false
}
```

**Note:** The `import type { Match }` line at the top of the appended block creates a cycle (useMatches.ts already imports from scoring.ts? Check first.) If a cycle exists, define a local minimal `MatchLike` type in scoring.ts with just the fields didIWin reads, and update the test to use it. Otherwise the import is fine.

Verify by inspecting `src/matches/useMatches.ts` for any imports from `../lib/scoring` — there shouldn't be any at this point. If clean, the import works as-is.

- [ ] **Step 5: Run — expect pass**

```bash
npm test -- didIWin
```

Expected: all 14 didIWin tests pass.

- [ ] **Step 6: Run full suite to confirm nothing broke**

```bash
npm test
```

Expected: all prior tests still pass + the 14 new ones.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: didIWin scoring helper + extend Match type with new columns"
```

---

### Task 3: buildMatchRow pure function (TDD)

**Files:**
- Create: `src/matches/buildMatchRow.ts`
- Create: `tests/buildMatchRow.test.ts`

This extracts the input→DB-row mapping out of `addMatch` for testability.

- [ ] **Step 1: Define NewMatchInput union — add to useMatches.ts**

In `src/matches/useMatches.ts`, replace the existing `export type NewMatchInput = { ... }` with the tagged union:

```ts
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
```

- [ ] **Step 2: Write failing test**

Create `tests/buildMatchRow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildMatchRow } from '../src/matches/buildMatchRow'

const me = 'user-me'

describe('buildMatchRow', () => {
  it('builds a singles row from singles input', () => {
    const row = buildMatchRow({
      type: 'singles',
      match_date: '2026-06-05',
      league_id: 'L1',
      opponent_contact_id: 'c-bob',
      your_games: 2,
      their_games: 1,
      notes: 'good match',
    }, me)
    expect(row).toEqual({
      match_type: 'singles',
      league_id: 'L1',
      match_date: '2026-06-05',
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: null,
      player2_contact_id: 'c-bob',
      player3_user_id: null,
      player3_contact_id: null,
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: 2,
      player2_games_won: 1,
      winner_position: null,
      notes: 'good match',
      entered_by: me,
    })
  })

  it('prefers opponent_user_id over opponent_contact_id in singles', () => {
    const row = buildMatchRow({
      type: 'singles',
      match_date: '2026-06-05',
      opponent_user_id: 'opp-user',
      opponent_contact_id: 'c-bob',
      your_games: 2,
      their_games: 0,
      notes: null,
    }, me)
    expect(row.player2_user_id).toBe('opp-user')
    expect(row.player2_contact_id).toBe(null)
  })

  it('builds a cutthroat row, winner = me', () => {
    const row = buildMatchRow({
      type: 'cutthroat',
      match_date: '2026-06-05',
      opp1_contact_id: 'c-bob',
      opp2_contact_id: 'c-sue',
      winner: 'me',
      notes: null,
    }, me)
    expect(row).toMatchObject({
      match_type: 'cutthroat',
      league_id: null,
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: null,
      player2_contact_id: 'c-bob',
      player3_user_id: null,
      player3_contact_id: 'c-sue',
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: 0,
      player2_games_won: 0,
      winner_position: 1,
      entered_by: me,
    })
  })

  it('builds a cutthroat row, winner = opp1', () => {
    const row = buildMatchRow({
      type: 'cutthroat',
      match_date: '2026-06-05',
      opp1_contact_id: 'c-bob',
      opp2_contact_id: 'c-sue',
      winner: 'opp1',
      notes: null,
    }, me)
    expect(row.winner_position).toBe(2)
  })

  it('builds a cutthroat row, winner = opp2', () => {
    const row = buildMatchRow({
      type: 'cutthroat',
      match_date: '2026-06-05',
      opp1_contact_id: 'c-bob',
      opp2_contact_id: 'c-sue',
      winner: 'opp2',
      notes: null,
    }, me)
    expect(row.winner_position).toBe(3)
  })

  it('builds a doubles row, my team wins', () => {
    const row = buildMatchRow({
      type: 'doubles',
      match_date: '2026-06-05',
      partner_contact_id: 'c-alice',
      opp1_contact_id: 'c-bob',
      opp2_contact_id: 'c-sue',
      winning_team: 'mine',
      notes: null,
    }, me)
    expect(row).toMatchObject({
      match_type: 'doubles',
      league_id: null,
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: null,
      player2_contact_id: 'c-alice',
      player3_user_id: null,
      player3_contact_id: 'c-bob',
      player4_user_id: null,
      player4_contact_id: 'c-sue',
      winner_position: 1,
      entered_by: me,
    })
  })

  it('builds a doubles row, their team wins', () => {
    const row = buildMatchRow({
      type: 'doubles',
      match_date: '2026-06-05',
      partner_contact_id: 'c-alice',
      opp1_contact_id: 'c-bob',
      opp2_contact_id: 'c-sue',
      winning_team: 'theirs',
      notes: null,
    }, me)
    expect(row.winner_position).toBe(2)
  })
})
```

- [ ] **Step 3: Run — expect failure**

```bash
npm test -- buildMatchRow
```

- [ ] **Step 4: Implement**

Create `src/matches/buildMatchRow.ts`:

```ts
import type { NewMatchInput } from './useMatches'

export type MatchRow = {
  match_type: 'singles' | 'cutthroat' | 'doubles'
  league_id: string | null
  match_date: string
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
}

function slot(userId?: string | null, contactId?: string | null) {
  if (userId) return { user_id: userId, contact_id: null }
  return { user_id: null, contact_id: contactId ?? null }
}

export function buildMatchRow(input: NewMatchInput, me: string): MatchRow {
  if (input.type === 'singles') {
    const opp = slot(input.opponent_user_id, input.opponent_contact_id)
    return {
      match_type: 'singles',
      league_id: input.league_id ?? null,
      match_date: input.match_date,
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: opp.user_id,
      player2_contact_id: opp.contact_id,
      player3_user_id: null,
      player3_contact_id: null,
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: input.your_games,
      player2_games_won: input.their_games,
      winner_position: null,
      notes: input.notes,
      entered_by: me,
    }
  }
  if (input.type === 'cutthroat') {
    const opp1 = slot(input.opp1_user_id, input.opp1_contact_id)
    const opp2 = slot(input.opp2_user_id, input.opp2_contact_id)
    const winnerPos = input.winner === 'me' ? 1 : input.winner === 'opp1' ? 2 : 3
    return {
      match_type: 'cutthroat',
      league_id: null,
      match_date: input.match_date,
      player1_user_id: me,
      player1_contact_id: null,
      player2_user_id: opp1.user_id,
      player2_contact_id: opp1.contact_id,
      player3_user_id: opp2.user_id,
      player3_contact_id: opp2.contact_id,
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: 0,
      player2_games_won: 0,
      winner_position: winnerPos,
      notes: input.notes,
      entered_by: me,
    }
  }
  // doubles
  const partner = slot(input.partner_user_id, input.partner_contact_id)
  const opp1 = slot(input.opp1_user_id, input.opp1_contact_id)
  const opp2 = slot(input.opp2_user_id, input.opp2_contact_id)
  return {
    match_type: 'doubles',
    league_id: null,
    match_date: input.match_date,
    player1_user_id: me,
    player1_contact_id: null,
    player2_user_id: partner.user_id,
    player2_contact_id: partner.contact_id,
    player3_user_id: opp1.user_id,
    player3_contact_id: opp1.contact_id,
    player4_user_id: opp2.user_id,
    player4_contact_id: opp2.contact_id,
    player1_games_won: 0,
    player2_games_won: 0,
    winner_position: input.winning_team === 'mine' ? 1 : 2,
    notes: input.notes,
    entered_by: me,
  }
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npm test -- buildMatchRow
```

Expected: 7 buildMatchRow tests pass.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: buildMatchRow + NewMatchInput tagged union"
```

---

### Task 4: addMatch uses buildMatchRow

**Files:**
- Modify: `src/matches/useMatches.ts`
- Modify: `tests/useMatches.test.tsx` (existing test asserts the old shape — update to the new tagged-union shape)

The existing useMatches test calls `result.current.addMatch({ match_date, opponent_contact_id, your_games, their_games, notes })`. After this task, callers must pass `type: 'singles'`. We update the test rather than maintain backward-compat.

- [ ] **Step 1: Update useMatches.ts addMatch body**

Find this block in `src/matches/useMatches.ts`:

```ts
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
```

Replace with:

```ts
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
```

And add the import at the top:

```ts
import { buildMatchRow } from './buildMatchRow'
```

- [ ] **Step 2: Update existing useMatches test for new input shape**

In `tests/useMatches.test.tsx`, find the `addMatch` invocation in the "inserts a new match" test:

```ts
      await result.current.addMatch({
        match_date: '2026-06-04',
        opponent_contact_id: 'c-bob',
        your_games: 2,
        their_games: 1,
        notes: null,
      })
```

Replace with:

```ts
      await result.current.addMatch({
        type: 'singles',
        match_date: '2026-06-04',
        opponent_contact_id: 'c-bob',
        your_games: 2,
        their_games: 1,
        notes: null,
      })
```

Also update the `insertCalls` expectation to include `match_type: 'singles'` and the new columns set to null:

```ts
    expect(insertCalls).toHaveBeenCalledWith(expect.objectContaining({
      match_type: 'singles',
      match_date: '2026-06-04',
      player1_user_id: 'me',
      player1_contact_id: null,
      player2_user_id: null,
      player2_contact_id: 'c-bob',
      player3_user_id: null,
      player3_contact_id: null,
      player4_user_id: null,
      player4_contact_id: null,
      player1_games_won: 2,
      player2_games_won: 1,
      winner_position: null,
      entered_by: 'me',
    }))
```

- [ ] **Step 3: Run tests**

```bash
npm test -- useMatches
```

Expected: 2 useMatches tests pass.

- [ ] **Step 4: Full suite**

```bash
npm test
```

Expected: all tests pass, including buildMatchRow + didIWin from previous tasks.

The `LogMatch.test.tsx` will FAIL at this step because it still calls `addMatch` with the old shape — we'll fix that in Task 6 after we update LogMatch itself. Skip the LogMatch test failures for now (TypeScript compile may also fail; you can comment out the test temporarily and re-enable in Task 6).

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "refactor: addMatch delegates to buildMatchRow"
```

---

### Task 5: Extract LogSingles from LogMatch

**Files:**
- Create: `src/matches/LogSingles.tsx`
- Modify: `src/matches/LogMatch.tsx` — temporarily, just delegate to LogSingles (we'll add type-toggle in Task 6)

This is a refactor with no behavior change. After it, LogMatch is just `<LogSingles />` (and the toggle UI will be added in Task 6).

- [ ] **Step 1: Create LogSingles**

Create `src/matches/LogSingles.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../contacts/useContacts'
import { useLeagues } from '../leagues/useLeagues'
import { useLeagueMembers } from '../leagues/useLeagueMembers'
import { useMatches } from './useMatches'
import { OpponentPicker } from './OpponentPicker'

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function LogSingles() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { leagues, loading: leaguesLoading } = useLeagues()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [leagueId, setLeagueId] = useState<string>('')
  const [opponentContactId, setOpponentContactId] = useState<string | null>(null)
  const [opponentUserId, setOpponentUserId] = useState<string | null>(null)
  const [yourGames, setYourGames] = useState<number>(2)
  const [theirGames, setTheirGames] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { members } = useLeagueMembers(leagueId || null)

  function handleLeagueChange(newLeagueId: string) {
    setLeagueId(newLeagueId)
    setOpponentContactId(null)
    setOpponentUserId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const haveOpponent = leagueId ? opponentUserId : opponentContactId
    if (!haveOpponent) {
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
        type: 'singles',
        match_date: date,
        league_id: leagueId || null,
        opponent_user_id: leagueId ? opponentUserId : null,
        opponent_contact_id: leagueId ? null : opponentContactId,
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

  const playableMembers = members.filter((m) => m.user_id !== null)
  const selectedMember = playableMembers.find((m) => m.user_id === opponentUserId)

  return (
    <>
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

        {!leaguesLoading && leagues.length > 0 && (
          <label className="block text-sm">
            League
            <select
              value={leagueId}
              onChange={(e) => handleLeagueChange(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="">Casual (no league)</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div>
          <span className="block text-sm mb-1">Opponent</span>
          {leagueId ? (
            selectedMember ? (
              <div className="flex items-center justify-between bg-white border border-slate-300 rounded px-3 py-2">
                <span>
                  #{selectedMember.seed_number} {selectedMember.name}
                </span>
                <button
                  type="button"
                  onClick={() => setOpponentUserId(null)}
                  className="text-sm text-emerald-700"
                >
                  Change
                </button>
              </div>
            ) : playableMembers.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active members in this league yet. Add members who have signed up.
              </p>
            ) : (
              <ul className="bg-white border border-slate-200 rounded divide-y divide-slate-100 max-h-48 overflow-auto">
                {playableMembers.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setOpponentUserId(m.user_id)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                    >
                      #{m.seed_number} {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : contactsLoading ? (
            <p className="text-sm text-slate-500">Loading contacts…</p>
          ) : (
            <OpponentPicker
              contacts={contacts}
              value={opponentContactId}
              onChange={setOpponentContactId}
            />
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
          disabled={
            saving || (leagueId ? !opponentUserId : !opponentContactId)
          }
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </>
  )
}
```

- [ ] **Step 2: Replace LogMatch.tsx body**

Overwrite `src/matches/LogMatch.tsx` (toggle UI comes in Task 6):

```tsx
import { LogSingles } from './LogSingles'

export function LogMatch() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Log Match</h1>
      <LogSingles />
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build succeeds. (Some tests may still be broken from Task 4 — that's fine; we fix in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "refactor: extract LogSingles from LogMatch"
```

---

### Task 6: Add Cutthroat and Doubles sub-forms + type toggle

**Files:**
- Create: `src/matches/LogCutthroat.tsx`
- Create: `src/matches/LogDoubles.tsx`
- Modify: `src/matches/LogMatch.tsx` (add the type-toggle pill)
- Modify: `tests/LogMatch.test.tsx` (re-enable; mocks already match)

- [ ] **Step 1: Build LogCutthroat**

Create `src/matches/LogCutthroat.tsx`:

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

export function LogCutthroat() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [opp1, setOpp1] = useState<string | null>(null)
  const [opp2, setOpp2] = useState<string | null>(null)
  const [winner, setWinner] = useState<'me' | 'opp1' | 'opp2'>('me')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!opp1 || !opp2) { setError('Pick two opponents.'); return }
    if (opp1 === opp2) { setError('Opponents must be different.'); return }
    setSaving(true); setError(null)
    try {
      await addMatch({
        type: 'cutthroat',
        match_date: date,
        opp1_contact_id: opp1,
        opp2_contact_id: opp2,
        winner,
        notes: notes.trim() || null,
      })
      navigate('/stats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  const opp1Contact = contacts.find((c) => c.id === opp1)
  const opp2Contact = contacts.find((c) => c.id === opp2)

  if (contactsLoading) return <p className="text-sm text-slate-500">Loading contacts…</p>

  return (
    <>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          Date
          <input type="date" value={date} required
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>

        <div>
          <span className="block text-sm mb-1">Opponent 1</span>
          <OpponentPicker contacts={contacts.filter((c) => c.id !== opp2)} value={opp1} onChange={setOpp1} />
        </div>

        <div>
          <span className="block text-sm mb-1">Opponent 2</span>
          <OpponentPicker contacts={contacts.filter((c) => c.id !== opp1)} value={opp2} onChange={setOpp2} />
        </div>

        <fieldset className="bg-white rounded-2xl p-3 shadow space-y-2">
          <legend className="text-sm font-medium">Who won?</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winner === 'me'} onChange={() => setWinner('me')} />
            You
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winner === 'opp1'} onChange={() => setWinner('opp1')} disabled={!opp1} />
            {opp1Contact?.name ?? 'Opponent 1'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winner === 'opp2'} onChange={() => setWinner('opp2')} disabled={!opp2} />
            {opp2Contact?.name ?? 'Opponent 2'}
          </label>
        </fieldset>

        <label className="block text-sm">
          Notes (optional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>

        <button type="submit" disabled={saving || !opp1 || !opp2}
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </>
  )
}
```

- [ ] **Step 2: Build LogDoubles**

Create `src/matches/LogDoubles.tsx`:

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

export function LogDoubles() {
  const { contacts, loading: contactsLoading } = useContacts()
  const { addMatch } = useMatches()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayIso())
  const [partner, setPartner] = useState<string | null>(null)
  const [opp1, setOpp1] = useState<string | null>(null)
  const [opp2, setOpp2] = useState<string | null>(null)
  const [winningTeam, setWinningTeam] = useState<'mine' | 'theirs'>('mine')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partner || !opp1 || !opp2) { setError('Pick a partner and two opponents.'); return }
    const ids = new Set([partner, opp1, opp2])
    if (ids.size !== 3) { setError('All three must be different.'); return }
    setSaving(true); setError(null)
    try {
      await addMatch({
        type: 'doubles',
        match_date: date,
        partner_contact_id: partner,
        opp1_contact_id: opp1,
        opp2_contact_id: opp2,
        winning_team: winningTeam,
        notes: notes.trim() || null,
      })
      navigate('/stats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  if (contactsLoading) return <p className="text-sm text-slate-500">Loading contacts…</p>

  const taken = new Set([partner, opp1, opp2].filter(Boolean) as string[])

  return (
    <>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          Date
          <input type="date" value={date} required
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>

        <div>
          <span className="block text-sm mb-1">Your partner</span>
          <OpponentPicker contacts={contacts.filter((c) => !taken.has(c.id) || c.id === partner)} value={partner} onChange={setPartner} />
        </div>

        <div>
          <span className="block text-sm mb-1">Opponent 1</span>
          <OpponentPicker contacts={contacts.filter((c) => !taken.has(c.id) || c.id === opp1)} value={opp1} onChange={setOpp1} />
        </div>

        <div>
          <span className="block text-sm mb-1">Opponent 2</span>
          <OpponentPicker contacts={contacts.filter((c) => !taken.has(c.id) || c.id === opp2)} value={opp2} onChange={setOpp2} />
        </div>

        <fieldset className="bg-white rounded-2xl p-3 shadow space-y-2">
          <legend className="text-sm font-medium">Winning team?</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winningTeam === 'mine'} onChange={() => setWinningTeam('mine')} />
            Your team (you + partner)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={winningTeam === 'theirs'} onChange={() => setWinningTeam('theirs')} />
            Their team
          </label>
        </fieldset>

        <label className="block text-sm">
          Notes (optional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" />
        </label>

        <button type="submit" disabled={saving || !partner || !opp1 || !opp2}
          className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save match'}
        </button>
      </form>
    </>
  )
}
```

- [ ] **Step 3: Add type toggle to LogMatch.tsx**

Overwrite `src/matches/LogMatch.tsx`:

```tsx
import { useState } from 'react'
import { LogSingles } from './LogSingles'
import { LogCutthroat } from './LogCutthroat'
import { LogDoubles } from './LogDoubles'

type MatchType = 'singles' | 'cutthroat' | 'doubles'

const TABS: Array<{ id: MatchType; label: string }> = [
  { id: 'singles', label: 'Singles' },
  { id: 'cutthroat', label: 'Cutthroat' },
  { id: 'doubles', label: 'Doubles' },
]

export function LogMatch() {
  const [type, setType] = useState<MatchType>('singles')

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Log Match</h1>

      <div className="flex bg-white rounded-2xl shadow p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium ${
              type === t.id ? 'bg-emerald-600 text-white' : 'text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === 'singles' && <LogSingles />}
      {type === 'cutthroat' && <LogCutthroat />}
      {type === 'doubles' && <LogDoubles />}
    </div>
  )
}
```

- [ ] **Step 4: Fix LogMatch.test.tsx (the existing tests target the singles flow inside LogMatch)**

The test imports `LogMatch` and asserts via DOM. After the toggle, the default tab is Singles, so the existing assertions still pass — but the test file has expectations specific to how the singles form is rendered. Re-read `tests/LogMatch.test.tsx` and verify that:

1. Test 1 (refuses to submit without opponent) — still works, the singles "Save match" button is rendered.
2. Test 2 (rejects tie score) — still works.
3. Test 3 (submits valid match) — the `addMatch` mock call now has `type: 'singles'` baked in. Update the assertion to include it:

```ts
    expect(addMatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'singles',
      opponent_contact_id: 'c-bob',
      your_games: 2,
      their_games: 0,
    }))
```

- [ ] **Step 5: Run + build**

```bash
npm test
npm run build
```

Expected: all tests pass, clean build.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: cutthroat + doubles sub-forms in Log Match with type toggle"
```

---

### Task 7: Extend MatchHistory to render all three types

**Files:**
- Modify: `src/matches/MatchHistory.tsx`

Currently MatchHistory assumes singles: pulls `player1_games_won` and `player2_games_won` and a single opponent. Extend to dispatch on `match_type`.

- [ ] **Step 1: Read the existing file**

Read `src/matches/MatchHistory.tsx` to see the current implementation.

- [ ] **Step 2: Replace the inner row renderer**

Overwrite `src/matches/MatchHistory.tsx`:

```tsx
import type { Match } from './useMatches'
import type { Contact } from '../contacts/useContacts'
import { didIWin } from '../lib/scoring'

function contactName(contactsById: Map<string, Contact>, contactId: string | null): string {
  if (!contactId) return '(unknown)'
  return contactsById.get(contactId)?.name ?? '(deleted)'
}

function summarize(m: Match, userId: string, contactsById: Map<string, Contact>): { line: string; tag: string } {
  if (m.match_type === 'singles') {
    const youArePlayer1 = m.player1_user_id === userId
    const yourGames = youArePlayer1 ? m.player1_games_won : m.player2_games_won
    const theirGames = youArePlayer1 ? m.player2_games_won : m.player1_games_won
    const oppContactId = youArePlayer1 ? m.player2_contact_id : m.player1_contact_id
    return {
      line: `vs ${contactName(contactsById, oppContactId)}`,
      tag: `${didIWin(m, userId) ? 'W' : 'L'} ${yourGames}–${theirGames}`,
    }
  }
  if (m.match_type === 'cutthroat') {
    const others = [m.player1_user_id, m.player2_user_id, m.player3_user_id]
      .map((uid, i) => {
        if (uid === userId) return null
        const cid = [m.player1_contact_id, m.player2_contact_id, m.player3_contact_id][i]
        return contactName(contactsById, cid)
      })
      .filter((x): x is string => x !== null)
    return {
      line: `Cutthroat — vs ${others.join(', ')}`,
      tag: didIWin(m, userId) ? 'W' : 'L',
    }
  }
  // doubles
  const myTeam = m.player1_user_id === userId || m.player2_user_id === userId ? 1 : 2
  const teamContacts = myTeam === 1
    ? [m.player2_contact_id]
    : [m.player3_contact_id, m.player4_contact_id]
  const oppContacts = myTeam === 1
    ? [m.player3_contact_id, m.player4_contact_id]
    : [m.player1_contact_id, m.player2_contact_id]
  const partner = teamContacts.map((c) => contactName(contactsById, c)).filter((s) => s !== '(unknown)')[0] ?? '?'
  const opps = oppContacts.map((c) => contactName(contactsById, c))
  return {
    line: `Doubles — you/${partner} vs ${opps.join(' / ')}`,
    tag: didIWin(m, userId) ? 'W' : 'L',
  }
}

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
        const { line, tag } = summarize(m, userId, contactsById)
        const won = didIWin(m, userId)
        return (
          <li key={m.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">{m.match_date}</div>
              <div className="font-medium">{line}</div>
            </div>
            <div className={`font-semibold ${won ? 'text-emerald-600' : 'text-slate-500'}`}>
              {tag}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: MatchHistory renders cutthroat + doubles rows"
```

---

### Task 8: Stats + Home use didIWin; head-to-head filters singles only

**Files:**
- Modify: `src/matches/Stats.tsx`
- Modify: `src/screens/Home.tsx`

- [ ] **Step 1: Update Stats.tsx**

Read `src/matches/Stats.tsx`. Replace the `toSummary` function — it currently considers only singles by checking `player1/2_user_id`. We need it to (a) only include singles in head-to-head summaries, and (b) the overall counter should include all match types via didIWin.

Replace the top of the file (imports) by adding `didIWin`:

```ts
import { summarizeHeadToHead, type MatchSummary, didIWin } from '../lib/scoring'
```

Find the rendering block for the overall card:

```tsx
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="text-sm text-slate-500">Overall</div>
        <div className="text-2xl font-bold">
          {summary.overall.wins}–{summary.overall.losses}
        </div>
        <div className="text-xs text-slate-500">
          {summary.overall.played} match{summary.overall.played === 1 ? '' : 'es'} played
        </div>
      </div>
```

Replace it with a derived overall that includes ALL match types:

```tsx
      {(() => {
        const wins = matches.filter((m) => didIWin(m, userId)).length
        const losses = matches.filter((m) =>
          !didIWin(m, userId) &&
          (m.player1_user_id === userId || m.player2_user_id === userId ||
            m.player3_user_id === userId || m.player4_user_id === userId)
        ).length
        const played = wins + losses
        return (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm text-slate-500">Overall</div>
            <div className="text-2xl font-bold">{wins}–{losses}</div>
            <div className="text-xs text-slate-500">
              {played} match{played === 1 ? '' : 'es'} played
            </div>
          </div>
        )
      })()}
```

The existing `summary` computed by `summarizeHeadToHead` is built from `toSummary` — which already filters out non-singles correctly (it checks `oppContactId` on the singles slots). But to be explicit, modify `toSummary` so the FIRST line skips non-singles:

```ts
function toSummary(matches: Match[], userId: string, contactsById: Map<string, { name: string }>): MatchSummary[] {
  return matches
    .filter((m) => m.match_type === 'singles')
    .map((m) => {
      // ... existing body unchanged
    })
    // ...
}
```

(Insert the `.filter` immediately after `matches` and before `.map`.)

- [ ] **Step 2: Update Home.tsx**

Find the win/loss calc in `src/screens/Home.tsx`:

```tsx
  const wins = matches.filter((m) =>
    (m.player1_user_id === userId ? m.player1_games_won : m.player2_games_won) >
    (m.player1_user_id === userId ? m.player2_games_won : m.player1_games_won)
  ).length
  const losses = matches.length - wins
```

Replace with `didIWin`-based logic:

```tsx
  const wins = matches.filter((m) => didIWin(m, userId)).length
  const losses = matches.filter((m) =>
    !didIWin(m, userId) &&
    (m.player1_user_id === userId || m.player2_user_id === userId ||
      m.player3_user_id === userId || m.player4_user_id === userId)
  ).length
```

And add the import:

```tsx
import { didIWin } from '../lib/scoring'
```

- [ ] **Step 3: Run + build**

```bash
npm test
npm run build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: Stats + Home use didIWin; H2H filters singles only"
```

---

### Task 9: Deploy + verify

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Smoke test on phone**

After Vercel finishes deploying:

1. Refresh the PWA (close + reopen).
2. Log tab → tap **Cutthroat** pill → date + 2 opponents + "Who won?" → Save.
3. Log tab → tap **Doubles** pill → date + partner + 2 opponents + "Winning team?" → Save.
4. Home → record should reflect the new wins/losses.
5. Stats → recent matches list should show both with "Cutthroat" / "Doubles" labels and W/L.
6. Stats → head-to-head should NOT have entries from these matches (only singles).

- [ ] **Step 3: Tag**

```bash
git tag plan-cutthroat-doubles-complete
git push --tags
```

---

## Self-Review

Coverage against the spec:

- ✅ Schema: match_type column + player3/4 columns + winner_position (Task 1)
- ✅ Drop & replace check constraints for all three formats (Task 1)
- ✅ `didIWin` pure function (Task 2)
- ✅ `Match` type extended with new fields (Task 2 Step 3)
- ✅ `NewMatchInput` tagged union (Task 3 Step 1)
- ✅ `buildMatchRow` pure function (Task 3)
- ✅ `addMatch` delegates to `buildMatchRow` (Task 4)
- ✅ `LogSingles` extracted (Task 5)
- ✅ `LogCutthroat`, `LogDoubles` (Task 6)
- ✅ Type toggle pill in `LogMatch` (Task 6)
- ✅ `MatchHistory` dispatches on match_type (Task 7)
- ✅ Stats overall includes all formats; H2H singles-only (Task 8)
- ✅ Home record uses `didIWin` (Task 8)

Out of scope (per spec):
- League play for cutthroat/doubles
- Match edit/delete (still append-only)
- Game-by-game scoring

Constraints documented but not testable inline (RLS / DB-level):
- The `matches_cutthroat_rules` and `matches_doubles_rules` constraints enforce `league_id = null`. If a buggy client tried to insert a cutthroat with league_id set, Postgres rejects it. No app-level test covers this; relying on DB enforcement is fine for now.

Type consistency check:
- `Match.match_type`: defined in Task 2 Step 3 as `'singles' | 'cutthroat' | 'doubles'`. Used consistently in didIWin, buildMatchRow, MatchHistory.
- `winner_position`: nullable smallint in DB, `number | null` in TS.
- `NewMatchInput.type` and `NewMatchInput.winner` / `winning_team`: defined in Task 3, consumed in Task 6 forms.

No placeholders found.
