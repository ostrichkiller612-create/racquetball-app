# Link Logged Matches to Schedule — Design

**Date:** 2026-06-05
**Owner:** Jim Herrington

## Purpose

Connect already-logged matches to imported `league_schedule` rows so the schedule shows results and the standings count matches played against opponents who haven't signed up yet (contact-based opponents).

## Goals

- Admin taps one button to scan logged matches and pair them with schedule rows.
- Preview of proposed pairings before anything is saved.
- Schedule list shows results inline for linked rows ("W 2–0").
- Standings attribute points through linked schedule rows, so matches vs contact-opponents count for both members.

## Non-goals

- Automatic background linking (button-triggered only, for now).
- Linking cutthroat/doubles matches (league schedule is singles-only).
- Un-linking UI (admin can delete the schedule row or re-import).

## Matching algorithm

For each schedule row in the league where `match_id is null`, scan candidate matches:

A match pairs with a schedule row when ALL of:
1. `match_type = 'singles'`.
2. `match_date` within ±3 days of `schedule.match_date`.
3. Both scheduled players are identifiable in the match:
   - A scheduled member matches a match player slot if:
     - member.user_id = player_user_id, OR
     - member.name ≈ contact name for player_contact_id (case-insensitive, trimmed)
   - Both schedule members (player1_member_id, player2_member_id) must match the two match player slots (in either order).
4. The match is not already linked to another schedule row.

Each match links to at most one schedule row; if multiple schedule rows could claim one match, the closest date wins.

Contact names are resolved through the current user's contacts (RLS-visible). Since the admin doing the linking is the person who logged the matches, this works; other members' casual matches vs contacts can't be seen by the admin and are out of scope.

## Adoption

When the admin confirms a pairing:
- `league_schedule.match_id` ← match id
- `matches.league_id` ← league id (adopts the match into the league)

The match row update is allowed by RLS only when `entered_by = auth.uid()`. If the match was entered by someone else, we still set `match_id` on the schedule (admin can) and skip the league_id adoption — standings attribution through the schedule link works regardless.

## Standings attribution (the important fix)

`Standings.tsx` currently maps match players to members via `user_id` only. New logic, in order:

1. Direct: match has `league_id = this league` and both player user_ids map to members (current behavior).
2. Via link: a `league_schedule` row in this league has `match_id` set. The schedule row's `player1_member_id`/`player2_member_id` identify the members. Game counts orient by figuring out which member corresponds to match player1:
   - If a member's `user_id` equals `match.player1_user_id`, that member gets `player1_games_won`.
   - Otherwise match player1 is the member whose name matches the contact name of `player1_contact_id` — fallback: the member whose user_id is null.
   - Tie-break safety: if orientation can't be determined, skip the match (don't guess).
3. De-dup: a match counted via the direct path is not counted again via a link.

## UI

### League page (admin only)

New button under "Import roster + schedule": **🔗 Match results to schedule**.

Tapping opens `/leagues/:id/link` with:
- A scanning pass (client-side query of matches + schedule + members + contacts)
- A list of proposed pairings: "Wk 3 — 5/28 — Jim vs Kaleb ← your match 5/28 W 2–1" with a checkbox per row (default checked)
- Rows that found no match are listed greyed-out ("no result found") for transparency
- Save button applies the checked pairings

### Schedule display

`ScheduleEditor` rows with `match_id` show the result chip: "W 2–0" / "L 1–2" oriented to... the viewing user when they're in the match, otherwise just "P1 2–0". Keep simple: show `player1_games – player2_games` oriented to the schedule's player1.

## Files

```
src/leagues/
├── LinkMatches.tsx        # /leagues/:id/link screen (scan, preview, save)
├── linkMatching.ts        # pure pairing algorithm (TDD)
└── Standings.tsx          # MODIFIED: link-aware attribution
src/leagues/ScheduleEditor.tsx  # MODIFIED: show result chip on linked rows
tests/linkMatching.test.ts
```

## Testing

- `tests/linkMatching.test.ts` — pure-function tests: user-id pairing, contact-name pairing, date window edges, closest-date tie-break, one-match-one-row, orientation resolution, skip-on-ambiguity.
- Manual smoke test: link Jim's real logged matches to the imported schedule, verify standings move.

## Out of scope (future)

- Auto-link on match save (when a new match matches a schedule row, link silently).
- Multi-admin conflict handling.
- Un-link UI.
