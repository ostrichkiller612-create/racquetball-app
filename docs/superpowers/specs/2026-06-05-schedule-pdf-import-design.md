# Schedule PDF Import — Design

**Date:** 2026-06-05
**Owner:** Jim Herrington

## Purpose

Let a league admin upload the league sheet (PDF or photo) and have the app extract:
- **Page 1 / image with roster:** league members (seed, name, phone)
- **Page 2 / image with schedule:** weekly matchups (week, date, time, court, two seed numbers)

Then review-and-edit inline before bulk-inserting into `league_members` and `league_schedule`.

## Goals

- One-tap import for the typical league season setup (instead of 13 weeks × 5 matchups manual entry).
- PDF path uses `pdfjs-dist` (extracts structured text directly — no OCR noise).
- Photo path uses existing Tesseract.js (already installed for contact import).
- Review-then-save UX — no silent inserts.
- Admin-only.

## Non-goals (this plan)

- Re-importing on top of an existing schedule. If schedule rows exist, the importer refuses with a "Clear schedule first" prompt.
- Editing existing rows via re-upload.
- Cloud OCR fallback.
- Automatic re-running every season.
- Phone uploads of multi-page PDFs (we only read pages 1 and 2; extra pages ignored).

## Architecture

All client-side. No new backend code.

```
src/
├── leagues/
│   ├── ImportLeague.tsx         # screen: file picker, year, parse, review, save
│   ├── ImportReview.tsx         # review tables (members + schedule), editable
│   └── importHelpers.ts         # bulk-insert helpers + duplicate-detection
├── lib/
│   ├── parseRosterText.ts       # extracted from parseSchedulePhoto (already works)
│   ├── parseScheduleText.ts     # NEW: parse page-2 grid text into rows
│   └── readPdfText.ts           # NEW: pdfjs-dist wrapper — text per page
tests/
├── parseScheduleText.test.ts
```

### Library choice

- **pdfjs-dist** for PDFs. Runs in-browser via web worker. Already battle-tested for text extraction.
- **Tesseract.js** for images (already a dep).

### Flow

```
ImportLeague
  ├── pick file (.pdf or image)
  ├── pick season year (default = current year)
  ├── Process
  │     ├── if PDF:  readPdfText(file) -> [page1Text, page2Text]
  │     │             rosterText = page1Text
  │     │             scheduleText = page2Text
  │     ├── if image: tesseract.recognize(file) -> oneText
  │     │             rosterText = scheduleText = oneText  (review will sort it)
  │     └── parsedMembers = parseRosterText(rosterText)
  │         parsedSchedule = parseScheduleText(scheduleText, year)
  ├── ImportReview (editable preview)
  │     ├── members section (existing matched by name, new highlighted)
  │     └── schedule section (week, date, time, court, p1 seed select, p2 seed select)
  └── Save
        ├── upsert league_members (skip if seed already exists with same name)
        └── insert league_schedule rows
```

## Data Model

No new tables — reuses `league_members` and `league_schedule` from earlier plans.

The schedule rows reference `league_members.id`, but parsed rows have seed numbers (1–10). The save step looks up `id` for each seed in the league's current roster (including just-inserted members).

## parseScheduleText format

The league PDF page 2 has blocks like:

```
16-Jan  Time  Court
1 vs 10  6:00  1
2 vs 9   6:00  2
...
```

Parser produces:

```ts
type ParsedScheduleRow = {
  week_number: number      // index of the week block (1..N)
  match_date: string       // YYYY-MM-DD, derived from "16-Jan" + year input
  start_time: string | null  // "HH:MM" 24h
  court: string | null
  player1_seed: number
  player2_seed: number
}
```

Date parsing:
- "16-Jan" + year 2026 → "2026-01-16"
- Tolerates "Jan 16", "1/16", "01/16/26" — keeps it simple, the review step lets admin fix any bad parse.

Time parsing:
- League play is evenings. Bare times (no AM/PM) like "6:00" or "7:00" are treated as PM → "18:00" / "19:00".
- Explicit AM/PM honored if present ("6:00 PM" → "18:00", "6:00 AM" → "06:00").
- The admin can override any time in the review step before saving.

Week numbers:
- Detected from the order of date headers in the PDF text. Each new date header = new week.

Court:
- Free text. Whatever the PDF has under the "Court" column.

Seed numbers:
- Parsed from `(number) vs (number)` patterns.

## Constraints

- Both parsers are lenient: anything malformed becomes `null` in the parsed row. The review screen highlights rows with missing fields and refuses to save them until fixed.
- If `parseScheduleText` returns 0 rows, the UI shows an error and offers the schedule editor as fallback.
- If the league already has schedule rows, the importer refuses upfront (no merge logic).

## UI Sketch

- League page → admin sees a new button: **📄 Import roster + schedule**.
- Tapping it navigates to `/leagues/:id/import`.
- Step 1: file picker + year input + Process button.
- Step 2 (after parse): two editable tables.
   - Members table: seed | name | phone | email | [delete row]. Existing members shown with strikethrough name and a "skip" toggle.
   - Schedule table: week | date (date input) | time (time input) | court (text) | P1 seed (select 1..N) | P2 seed (select 1..N) | [delete row]
- Step 3: Save button (disabled if any row has missing required fields).

## Testing

- `tests/parseScheduleText.test.ts` — pure-function tests using the Thursday-C-League text we have on hand. Edge cases: missing time, missing court, single-game line.
- No new tests for the PDF reader (it's a thin wrapper around pdfjs-dist; manual smoke test on the actual league PDF covers it).

## Out of scope (future)

- Re-import / merge with existing schedule.
- Handling tournament brackets (semifinals / finals).
- Multi-image upload (page 1 photo + page 2 photo).
- Editing roster from this screen (use the existing roster editor for changes after import).
