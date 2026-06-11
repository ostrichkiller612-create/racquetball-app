# Board Points — Design

**Date:** 2026-06-05
**Owner:** Jim Herrington

## Purpose

The gym maintains the official league point totals handwritten on a board. Capture those totals in the app — by photo (OCR pre-fill) or quick manual entry — and make them the standings ranking, with the app's computed points shown alongside for comparison.

## Goals

- "Board points" screen: roster with a number input per member. Type 10 numbers in ~30s.
- Optional photo pre-fill: Tesseract OCR attempts the handwritten board; whatever it recognizes pre-fills the grid; admin corrects and saves.
- Standings rank by board points when any are present; computed points shown small next to them.
- Admin-only writes.

## Non-goals

- Historical snapshots of board state (only current totals are stored).
- Treating board points as match data — they're a display/ranking override only.
- High-accuracy handwriting OCR (expectation set: it's a pre-fill, not a parser you trust).

## Data model

Migration `0009_board_points.sql`:

```sql
alter table public.league_members
  add column board_points int,
  add column board_updated_at timestamptz;
```

Existing `league_members_update_admin` RLS policy already restricts writes to league admins. No new policies.

## Parser

`parseBoardPoints(text, members)` — pure function. For each member, fuzzy-find their name in the OCR text (full name, else last-name token, else first-name token, case-insensitive) and take the nearest number (0–999) on the same line after the name. Returns `Map<memberId, number>` of hits only — misses stay blank in the grid.

## UI

- League page (admin): new button **🏷 Board points** → `/leagues/:id/board`.
- Screen: optional "📷 From photo" button on top (Tesseract w/ progress bar, pre-fills grid), then the roster grid (seed, name, number input), Save button.
- Save: one `update` per changed member setting `board_points` + `board_updated_at = now()`.

## Standings

- `LeagueMember` type gains `board_points`.
- If ANY member has non-null `board_points`: sort standings by board points desc (nulls last, then computed points as tie-break). Points column shows board points; computed points render small/grey beside ("12 · app 9").
- If no board points: current computed behavior unchanged.
- A small footnote shows "Board updated <date>" using the max `board_updated_at`.

## Files

```
supabase/migrations/0009_board_points.sql
src/leagues/
├── BoardPoints.tsx          # /leagues/:id/board screen
├── parseBoardPoints.ts      # pure OCR-text → member points map
├── Standings.tsx            # MODIFIED: board ranking + computed-small display
└── useLeagueMembers.ts      # MODIFIED: type gains board_points/board_updated_at
tests/parseBoardPoints.test.ts
```

## Testing

- `parseBoardPoints`: full-name hit, last-name fallback, number-on-same-line, ignores numbers on other lines, no-match leaves member out, picks nearest number when several.
- Manual: photo of the real board; verify pre-fill quality and manual correction flow.
