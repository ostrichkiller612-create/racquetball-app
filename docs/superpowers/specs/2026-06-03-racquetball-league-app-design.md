# Racquetball League App — Design

**Date:** 2026-06-03
**Owner:** Jim Herrington

## Purpose

A phone-friendly web app for tracking racquetball match results and league play. Starts as a personal tracker, opens up to league members so the whole league can record matches, view standings, and coordinate weekly matchups via SMS.

## Goals

- Log matches against league members or personal contacts in under 15 seconds.
- One-tap "text my opponent this week" button on the home screen.
- Live league standings that update as members enter results.
- Works on Android and iPhone via "Add to Home Screen" — no app store.
- Free to run for a single league of ~10 players.

## Non-goals (v1)

- Native iOS / Android apps.
- Automatic SMS sending (Twilio etc.).
- Match-result confirmation by the opponent.
- Court reservation, fees, or payments.

## Stack

- **Frontend:** React + Vite, TypeScript, Tailwind CSS. Built as a PWA (manifest + service worker) so it installs to the home screen.
- **Backend:** Supabase — Postgres database, Auth (email/password + magic link + Google), Row-Level Security, plus one Edge Function for PDF parsing.
- **Hosting:** Vercel for the frontend (one serverless function for PDF parsing if Supabase Edge Functions prove awkward). Supabase free tier for backend.
- **Cost target:** $0/month at current scale.

## Data Model

### `users` (managed by Supabase Auth)

Profile extension:

- `id` (uuid, FK to auth.users)
- `display_name` (text)
- `phone` (text, nullable) — used for the text-opponent feature
- `default_text_template` (text, nullable) — e.g. "Hey {name}, confirming our match {when}?"

### `leagues`

- `id` (uuid)
- `name` (text) — e.g. "Thursday C League Spring 2026"
- `created_by` (uuid, FK to users)
- `created_at` (timestamptz)

### `league_members`

- `id` (uuid)
- `league_id` (uuid, FK)
- `user_id` (uuid, FK to users, nullable) — null for placeholder members not yet signed up
- `seed_number` (int) — 1–N within the league; used by the schedule
- `name` (text) — used when user_id is null, or as override
- `phone` (text, nullable)
- `email` (text, nullable) — used to auto-link when a matching user signs up
- `role` (enum: 'admin' | 'member')

Unique constraint: `(league_id, seed_number)`.

### `contacts`

Owner's personal opponent list, for non-league or pre-league play.

- `id` (uuid)
- `owner_id` (uuid, FK to users)
- `name` (text)
- `phone` (text, nullable)
- `linked_user_id` (uuid, FK to users, nullable) — set if this contact corresponds to a real user

### `matches`

- `id` (uuid)
- `league_id` (uuid, FK, nullable) — null for casual matches
- `match_date` (date)
- `player1_user_id` (uuid, nullable)
- `player1_contact_id` (uuid, nullable)
- `player2_user_id` (uuid, nullable)
- `player2_contact_id` (uuid, nullable)
- `player1_games_won` (smallint)
- `player2_games_won` (smallint)
- `notes` (text, nullable)
- `entered_by` (uuid, FK to users)
- `created_at` (timestamptz)

Constraint: exactly one of `player1_user_id` / `player1_contact_id` is non-null (same for player2). Winner is derived (`player1_games_won > player2_games_won`).

### `league_schedule`

- `id` (uuid)
- `league_id` (uuid, FK)
- `week_number` (int)
- `match_date` (date)
- `start_time` (time) — e.g. 18:00 or 19:00
- `court` (text) — e.g. "1", "2", "3"
- `player1_seed` (int)
- `player2_seed` (int)
- `match_id` (uuid, FK to matches, nullable) — set once the match is logged, linking schedule slot to result

## Scoring

Per the existing league rule sheet:

- Match winner: **3 points** (regardless of game count)
- Loser: **1 point** if they won at least one game, **0** otherwise

Points are derived from `matches.player[12]_games_won`, not stored separately. Standings page computes totals on the fly.

## Permissions (Row-Level Security)

- **Users:** can read all profiles in leagues they belong to. Can edit only their own profile.
- **Leagues / league_members:** any authenticated user can create a league (becomes admin). Members can read. Only admins can add/remove members or upload schedules.
- **Contacts:** owner-only — read and write restricted to `owner_id = auth.uid()`.
- **Matches:** league members can read all matches in their league(s). Anyone in the league can write any match (no opponent confirmation, per requirement). Casual matches (no league_id) are owner-only.
- **League schedule:** league members can read; only admins can write.

## Screens

Bottom-nav app with four tabs.

### Sign In

Supabase Auth UI. Three options on one screen: email/password, magic link, "Continue with Google."

### Home / This Week

- Top card: your scheduled league match this week.
  - "Thu 1/16 @ 6:00 PM, Court 1"
  - "vs Bill Boulden"
  - Big button: **"Text Bill"** — opens `sms:` link with phone + pre-filled message
  - If no scheduled match this week: card shows "No league match scheduled this week."
- Middle card: overall record (e.g. "W-L: 12-7").
- Bottom card: last 5 matches, tap any to view detail.

### Log Match

- Opponent picker — searchable list combining league members + your contacts (deduped where a contact is linked to a user).
- Date (defaults to today).
- League dropdown — auto-set if opponent is in exactly one shared league; selectable otherwise; can be set to "Casual."
- Games won: two number inputs (yours / theirs).
- Notes (optional, expandable).
- Save → returns to Home.

### Stats

- Overall: W-L, win %.
- Head-to-head: scrollable list of opponents with W-L vs each, sortable by name, matches played, or win %.
- League filter dropdown (defaults to "All").

### Standings (visible only when in a league)

- Table of league members: rank, seed, name, matches played, points, games won/lost.
- Live — recomputes on each match insert.

### Leagues

- List of leagues you're in.
- "Create league" → name + you become admin → upload PDF or start blank.
- League detail: roster, schedule, admin actions (upload PDF, edit members, edit schedule).

### Contacts

- Personal contact list — add, edit, delete.
- Shows linked status (e.g. "Linked to Bill Boulden (user)").

## Key Flows

### Text opponent

1. Home reads `league_schedule` filtered to current week + leagues you belong to + your `seed_number`.
2. Finds the matchup; identifies opponent's `league_members` row, prefers `user.phone`, falls back to `league_members.phone`.
3. Tap → `sms:+1${phone}?body=${encodedTemplate}` with `{name}` and `{when}` interpolated.
4. Android / iOS messaging app opens with text ready. User taps send.

### PDF schedule upload (admin only)

1. Admin uploads a league PDF on the Leagues screen.
2. PDF is sent to a serverless function (Vercel `/api/parse-league-pdf` or Supabase Edge Function) that runs `pdf-parse` (or `pdfjs-dist`) to extract text.
3. Parser identifies two sections:
   - **Roster** (page 1): rows of `seed | name | phone`.
   - **Schedule** (page 2): per-date blocks of `seedA VS seedB  HH:MM  Court#`.
4. Server returns structured JSON: `{ members: [...], weeks: [...] }`.
5. Frontend renders editable preview tables. Rows that failed to parse cleanly are highlighted.
6. Admin reviews, edits anything wrong, hits **Save**.
7. Backend writes `league_members` rows (placeholder for those without accounts) and `league_schedule` rows.

Fallback: a "Start blank, enter manually" button on the Leagues page — opens the same editable preview UI with empty rows.

### CSV roster auto-link

When a new user signs up, server checks `league_members` for any placeholder rows with a matching email. If found, sets `user_id` and the new user is automatically a member with their existing match history intact.

### Log a match

1. Tap **Log Match** tab.
2. Pick opponent → autosets league if unambiguous.
3. Enter games won. (Format hint: "2-0" or "2-1" guidance below the fields.)
4. Save → matches row inserted. If a `league_schedule` row matches (same league, same date ±3 days, same two players), set `schedule.match_id`.
5. Standings recompute on next page load.

## Components / Boundaries

Frontend modules, each with one clear job:

- `auth/` — Supabase session handling, sign-in screen.
- `home/` — Home tab: schedule lookup, record card, recent matches.
- `log-match/` — opponent picker, form, submit.
- `stats/` — overall + head-to-head queries and views.
- `standings/` — league standings table + scoring derivation.
- `leagues/` — league list, create, roster + schedule views, PDF upload UI.
- `contacts/` — contact CRUD.
- `lib/supabase.ts` — single client instance.
- `lib/scoring.ts` — pure functions: `matchPoints(games1, games2)` returns `[p1Pts, p2Pts]`.
- `lib/sms.ts` — builds the `sms:` URL with template interpolation.

Backend:

- `api/parse-league-pdf` (serverless) — accepts PDF, returns structured JSON. Pure parser, no DB writes.

## Testing

- Unit tests for `lib/scoring.ts` (scoring edge cases: 2-0, 2-1 win/loss, ties not allowed).
- Unit tests for `lib/sms.ts` (URL encoding, template interpolation).
- Unit tests for the PDF parser given a fixture of the actual "Thursday C League" PDF.
- Integration tests for RLS policies (Supabase has a test harness).
- Manual smoke test on Android Chrome and iPhone Safari for PWA install + `sms:` link behavior before each release.

## Risks

- **PDF parsing brittleness.** Mitigated by always showing an editable preview and providing the blank-start fallback. If parsing breaks on a future league sheet, admin still finishes setup by editing the preview.
- **No opponent confirmation.** Anyone can enter any match in their league. Acceptable per user requirement; can add a "flag this match" feature later if disputes arise.
- **PWA on iOS quirks.** Service worker behavior on iOS Safari is more limited than Android. App should function without service worker; it's progressive enhancement.

## Open questions

None blocking. Future considerations:

- Should we support recording forfeits explicitly?
- Should past-season schedules be archived or kept visible?
- Should the league admin be able to delete or edit other people's match entries?
