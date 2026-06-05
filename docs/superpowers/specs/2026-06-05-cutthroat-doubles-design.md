# Cutthroat & Doubles Match Types — Design

**Date:** 2026-06-05
**Owner:** Jim Herrington

## Purpose

Extend match logging to support **cutthroat** (3 players) and **doubles** (4 players in 2 teams), in addition to the existing singles format. Both new formats are casual-only — they affect overall W-L but not league standings or head-to-head numbers.

## Goals

- Record cutthroat matches (1 winner among 3 players) in under 30 seconds.
- Record doubles matches (1 winning team of 2) in under 30 seconds.
- Existing singles flow stays unchanged.
- Overall W-L card reflects all three formats; head-to-head table remains singles-only.

## Non-goals

- League play for cutthroat/doubles (singles-only in leagues).
- Detailed score capture (game-by-game scoring). We track who won, full stop.
- Team-level standings or partner statistics.

## Schema

Single migration `0007_match_types.sql` extends the existing `matches` table:

```sql
alter table public.matches
  add column match_type text not null default 'singles'
    check (match_type in ('singles', 'cutthroat', 'doubles')),
  add column player3_user_id uuid references auth.users(id) on delete set null,
  add column player3_contact_id uuid references public.contacts(id) on delete set null,
  add column player4_user_id uuid references auth.users(id) on delete set null,
  add column player4_contact_id uuid references public.contacts(id) on delete set null,
  add column winner_position smallint;
```

### Per-format invariants (enforced via check constraints)

- **Singles:** player1+player2 set, player3/4 null, `player1_games_won` and `player2_games_won` not equal, `winner_position` null, `league_id` may be set.
- **Cutthroat:** player1/2/3 set, player4 null, `winner_position` in (1, 2, 3), `player1_games_won` and `player2_games_won` ignored (set to 0), `league_id` null.
- **Doubles:** all four players set, `winner_position` in (1, 2) where team 1 = players 1+2, team 2 = players 3+4, games_won ignored, `league_id` null.

### Drop existing constraints, add new ones

The existing `matches_player1_exclusive`, `matches_player2_exclusive`, `matches_not_self`, and `matches_no_draws` constraints assume the singles model. The migration drops them and adds a single more general set:

```sql
alter table public.matches
  drop constraint if exists matches_player1_exclusive,
  drop constraint if exists matches_player2_exclusive,
  drop constraint if exists matches_not_self,
  drop constraint if exists matches_no_draws;

-- For positions 1..4, exactly one of (user_id, contact_id) non-null if the slot is used.
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

-- Format-specific rules
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

(RLS policies are unchanged — they reference `entered_by` and `league_id` only.)

## Scoring / "did I win"

A pure helper in `src/lib/scoring.ts`:

```ts
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
    const myPos = match.player1_user_id === userId ? 1
      : match.player2_user_id === userId ? 2
      : match.player3_user_id === userId ? 3
      : null
    return myPos !== null && match.winner_position === myPos
  }
  if (match.match_type === 'doubles') {
    const myTeam = match.player1_user_id === userId || match.player2_user_id === userId ? 1
      : match.player3_user_id === userId || match.player4_user_id === userId ? 2
      : null
    return myTeam !== null && match.winner_position === myTeam
  }
  return false
}
```

## UI

### Log Match screen

New top control: a three-button pill switch labelled **Singles / Cutthroat / Doubles**. Default is Singles. Switching modes resets the form fields and sets the league dropdown to **Casual** (and disables it) for cutthroat/doubles.

Three sub-forms, each its own file, render conditionally below the type switch:

- **`LogSingles.tsx`** — extracted from the existing LogMatch body. Date, opponent, your games / their games, notes.
- **`LogCutthroat.tsx`** — date, two opponent slots (Opponent 1, Opponent 2) using the existing OpponentPicker, a "Who won?" radio (You / Opp1's name / Opp2's name), notes.
- **`LogDoubles.tsx`** — date, "Your partner" slot, two opponent slots, "Winning team?" radio (Your team / Their team), notes.

Each sub-form has its own submit button and calls `addMatch` with the appropriate input shape.

### Match history rows

`MatchHistory.tsx` gets a per-row renderer dispatching on `match_type`:

- **Singles:** `vs Bob | W 2-1` (unchanged)
- **Cutthroat:** `Cutthroat — you, Bob, Carol | W` or `L` (no score, just outcome)
- **Doubles:** `Doubles — you/Alice vs Bob/Carol | W` or `L`

Names resolve through contacts (and later, league members) the same way they do today.

### Stats page

Overall W-L card sums wins/losses across all three formats using `didIWin`. The head-to-head table is filtered to `match_type = 'singles'` to keep its semantics clean.

## Code Structure

```
src/
├── matches/
│   ├── LogMatch.tsx          # type switch + conditional sub-form
│   ├── LogSingles.tsx        # extracted from old LogMatch
│   ├── LogCutthroat.tsx      # NEW
│   ├── LogDoubles.tsx        # NEW
│   ├── MatchHistory.tsx      # extended to render 3 layouts
│   ├── useMatches.ts         # NewMatchInput union extended; addMatch delegates to buildMatchRow
│   └── buildMatchRow.ts      # NEW: pure (NewMatchInput, userId) -> DB row mapping
├── lib/
│   └── scoring.ts            # add didIWin(match, userId)
supabase/migrations/
└── 0007_match_types.sql
tests/
├── didIWin.test.ts           # NEW
└── parseMatchInput.test.ts   # NEW (validates LogMatch -> addMatch mapping)
```

## NewMatchInput shape

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

`addMatch` maps each branch to the right columns:
- Singles: player1 = me, player2 = opponent, games_won = your/their_games
- Cutthroat: player1 = me, player2 = opp1, player3 = opp2, winner_position = {me:1, opp1:2, opp2:3}[winner]
- Doubles: player1 = me, player2 = partner, player3 = opp1, player4 = opp2, winner_position = {mine:1, theirs:2}[winning_team]

## Testing

- `tests/didIWin.test.ts`: pure-function tests covering all three types + both win/loss outcomes + the "I'm not in this match" edge case.
- `tests/buildMatchRow.test.ts`: pure-function tests over `buildMatchRow(input, userId)` — extracted from `addMatch` so the input → DB-row mapping is testable in isolation. Covers all three variants.
- Existing tests for `summarizeHeadToHead` and `leagueStandings` keep passing unchanged — both still consume singles matches only. `summarizeHeadToHead` will be updated to filter by `match_type === 'singles'` at the caller (in `Stats.tsx`). `leagueStandings` is unaffected because `league_id` is always null for non-singles, and the league standings query already filters by `league_id`.

## Migration risk

Existing data: all current matches have `match_type` defaulted to `'singles'` (added with `default 'singles'`). They pass the new `matches_singles_rules` constraint because they already satisfy `player1_games_won <> player2_games_won` (from the old `matches_no_draws` constraint that we're dropping but already enforced). No backfill needed.

The constraint drop-and-recreate happens atomically inside the migration — there's no window where the table has neither old nor new constraints active.

## Out of scope (future)

- League play for cutthroat/doubles (would need league_schedule to support multi-player slots).
- Edit/delete of cutthroat/doubles matches — same as singles today: append-only. Plan a follow-up if needed.
- Partner-based stats ("doubles record with Alice as partner").
- Score capture beyond winner_position.
