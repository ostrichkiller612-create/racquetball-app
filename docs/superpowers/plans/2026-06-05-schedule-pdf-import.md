# Schedule PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin uploads the league sheet (PDF or photo) inside a league → app extracts roster + schedule → admin reviews/edits → bulk-saves `league_members` and `league_schedule` rows.

**Architecture:** Client-side only. `pdfjs-dist` extracts text from PDF pages; Tesseract.js (already installed) handles images. Two new pure parsers (`parseRosterText`, `parseScheduleText`) turn text into structured rows. A two-section editable review screen lets the admin verify before saving.

**Tech Stack:** pdfjs-dist (new), Tesseract.js (existing), React + TS + Tailwind + Supabase.

**Working directory:** `C:\Users\jim.h\OneDrive - Pine Pharmaceuticals\Desktop\racquetball-app`

---

## File Structure (additions)

```
src/
├── leagues/
│   ├── ImportLeague.tsx         # screen: file picker, year, parse, review, save
│   └── ImportReview.tsx         # review tables (members + schedule), editable
├── lib/
│   ├── parseRosterText.ts       # NEW: extracted parser, lives next to schedule parser
│   ├── parseScheduleText.ts     # NEW
│   └── readPdfText.ts           # NEW: pdfjs-dist wrapper
tests/
├── parseRosterText.test.ts      # moved/renamed from parseSchedulePhoto.test.ts
├── parseScheduleText.test.ts
```

We keep the existing `src/contacts/parseSchedulePhoto.ts` working by re-exporting from `parseRosterText.ts` — the contacts photo import path keeps its current behavior.

---

### Task 1: pdfjs-dist install + readPdfText wrapper

**Files:**
- Create: `src/lib/readPdfText.ts`

- [ ] **Step 1: Install pdfjs-dist**

```bash
npm install pdfjs-dist
```

- [ ] **Step 2: Configure the worker**

pdfjs-dist needs a worker file for parsing. The standard Vite pattern: import the worker entry as a URL using Vite's `?url` import. Verify the version installed:

```bash
node -e "console.log(require('pdfjs-dist/package.json').version)"
```

- [ ] **Step 3: Create the wrapper**

Create `src/lib/readPdfText.ts`:

```ts
import * as pdfjsLib from 'pdfjs-dist'
// Vite-native worker URL. Bundled into the output, served by Vercel.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Reads a PDF file and returns one string per page (concatenated text content).
 * pdfjs-dist returns text items in document order; we join with spaces.
 */
export async function readPdfText(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }
  return pages
}
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: build succeeds. pdfjs worker file appears in the build output.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: pdfjs-dist + readPdfText wrapper"
```

---

### Task 2: parseRosterText — promote from contacts module

**Files:**
- Create: `src/lib/parseRosterText.ts`
- Modify: `src/contacts/parseSchedulePhoto.ts` (re-export from new location)
- Move: `tests/parseSchedulePhoto.test.ts` → `tests/parseRosterText.test.ts`

The existing `parseSchedulePhoto` already does exactly what we need for roster parsing. We promote it to `lib/` and rename.

- [ ] **Step 1: Read the current parseSchedulePhoto.ts**

Read `src/contacts/parseSchedulePhoto.ts` so you have the current contents in mind.

- [ ] **Step 2: Create src/lib/parseRosterText.ts with the same body**

Copy the entire contents of `src/contacts/parseSchedulePhoto.ts` into a new file at `src/lib/parseRosterText.ts`, but rename:
- Function `parseSchedulePhoto` → `parseRosterText`
- Type `ParsedContact` → `ParsedRosterEntry`

The function signature and behavior are identical.

- [ ] **Step 3: Replace src/contacts/parseSchedulePhoto.ts contents with a re-export**

Overwrite `src/contacts/parseSchedulePhoto.ts` with:

```ts
// Back-compat: ImportContacts.tsx imports parseSchedulePhoto + ParsedContact from here.
// Implementation now lives in src/lib/parseRosterText.ts.
export {
  parseRosterText as parseSchedulePhoto,
  type ParsedRosterEntry as ParsedContact,
} from '../lib/parseRosterText'
```

- [ ] **Step 4: Move + rename the test**

Delete `tests/parseSchedulePhoto.test.ts`.
Create `tests/parseRosterText.test.ts` with the same test bodies, but change the import line at the top:

```ts
import { parseRosterText } from '../src/lib/parseRosterText'
```

And update every `parseSchedulePhoto(` call site in the test file to `parseRosterText(`.

The expected output type stays compatible (same shape).

- [ ] **Step 5: Run tests**

```bash
npm test -- parseRosterText
```

Expected: all 9 tests pass (or whatever count the original had).

- [ ] **Step 6: Full suite + build**

```bash
npm test
npm run build
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "refactor: promote parseSchedulePhoto -> lib/parseRosterText"
```

---

### Task 3: parseScheduleText (TDD)

**Files:**
- Create: `src/lib/parseScheduleText.ts`
- Create: `tests/parseScheduleText.test.ts`

**Output shape:**

```ts
export type ParsedScheduleRow = {
  week_number: number
  match_date: string         // YYYY-MM-DD
  start_time: string | null  // HH:MM, 24h
  court: string | null
  player1_seed: number
  player2_seed: number
}
```

**Date convention:** Inputs like `16-Jan`, `Jan 16`, `1/16`, `01/16/26` are accepted. Year input by the caller (e.g., 2026) used when not in the string.

**Time convention:** Bare times (no AM/PM) are PM. So `6:00` → `18:00`, `7:00` → `19:00`. `12:00` stays `12:00`. Explicit AM/PM honored.

- [ ] **Step 1: Write failing test**

Create `tests/parseScheduleText.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseScheduleText } from '../src/lib/parseScheduleText'

describe('parseScheduleText', () => {
  it('parses a small block with one week', () => {
    const text = `
      16-Jan Time Court
      1 vs 10 6:00 1
      2 vs 9 6:00 2
      3 vs 8 6:00 3
      4 vs 7 7:00 1
      5 vs 6 7:00 2
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows).toHaveLength(5)
    expect(rows[0]).toEqual({
      week_number: 1,
      match_date: '2026-01-16',
      start_time: '18:00',
      court: '1',
      player1_seed: 1,
      player2_seed: 10,
    })
    expect(rows[3]).toEqual({
      week_number: 1,
      match_date: '2026-01-16',
      start_time: '19:00',
      court: '1',
      player1_seed: 4,
      player2_seed: 7,
    })
  })

  it('parses multiple weeks and increments week_number per date header', () => {
    const text = `
      16-Jan Time Court
      1 vs 10 6:00 1
      23-Jan Time Court
      1 vs 9 6:00 1
      30-Jan
      1 vs 8 6:00 1
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows.map((r) => r.week_number)).toEqual([1, 2, 3])
    expect(rows.map((r) => r.match_date)).toEqual([
      '2026-01-16',
      '2026-01-23',
      '2026-01-30',
    ])
  })

  it('treats bare times as PM (league play convention)', () => {
    const text = `
      16-Jan
      1 vs 10 6:00 1
      2 vs 9 7:00 2
      3 vs 8 12:00 3
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows.map((r) => r.start_time)).toEqual(['18:00', '19:00', '12:00'])
  })

  it('honors explicit AM/PM', () => {
    const text = `
      16-Jan
      1 vs 10 6:00 AM 1
      2 vs 9 6:00 PM 2
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows.map((r) => r.start_time)).toEqual(['06:00', '18:00'])
  })

  it('handles missing court', () => {
    const text = `
      16-Jan
      1 vs 10 6:00
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows[0].court).toBeNull()
    expect(rows[0].start_time).toBe('18:00')
  })

  it('handles missing time and court', () => {
    const text = `
      16-Jan
      1 vs 10
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows[0].start_time).toBeNull()
    expect(rows[0].court).toBeNull()
  })

  it('accepts US-format dates (1/16 with year inference)', () => {
    const text = `
      1/16
      1 vs 10 6:00 1
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows[0].match_date).toBe('2026-01-16')
  })

  it('accepts US-format dates with explicit year (1/16/26)', () => {
    const text = `
      1/16/26
      1 vs 10 6:00 1
    `
    const rows = parseScheduleText(text, 2030)
    // Explicit 26 wins
    expect(rows[0].match_date).toBe('2026-01-16')
  })

  it('returns empty array if no recognizable patterns', () => {
    expect(parseScheduleText('just nonsense here', 2026)).toEqual([])
  })

  it('ignores stray (non-matchup) numbers', () => {
    const text = `
      Page 2 of the document
      16-Jan Time Court
      1 vs 10 6:00 1
    `
    const rows = parseScheduleText(text, 2026)
    expect(rows).toHaveLength(1)
    expect(rows[0].player1_seed).toBe(1)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm test -- parseScheduleText
```

- [ ] **Step 3: Implement**

Create `src/lib/parseScheduleText.ts`:

```ts
export type ParsedScheduleRow = {
  week_number: number
  match_date: string
  start_time: string | null
  court: string | null
  player1_seed: number
  player2_seed: number
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

// Recognize "16-Jan", "Jan 16", "1/16", "01/16/26"
const DATE_RE = /(?:(\d{1,2})[-\s]+([A-Za-z]{3,9}))|(?:([A-Za-z]{3,9})[-\s]+(\d{1,2}))|(?:(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?)/g

// Match "N vs M" with optional time (HH:MM with optional AM/PM) and optional court (single token)
const ROW_RE = /(\d{1,2})\s*(?:vs|v\.?|x)\s*(\d{1,2})(?:\s+(\d{1,2}:\d{2})(?:\s*(am|pm|AM|PM))?)?(?:\s+([A-Za-z0-9]+))?/g

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function normalizeTime(raw: string, ampm: string | undefined): string {
  const [h, m] = raw.split(':').map(Number)
  let hour = h
  const ap = ampm?.toLowerCase()
  if (ap === 'am') {
    if (hour === 12) hour = 0
  } else if (ap === 'pm') {
    if (hour < 12) hour += 12
  } else {
    // No AM/PM provided. League convention: bare times in 1..11 are PM.
    if (hour >= 1 && hour <= 11) hour += 12
    // hour 12 stays 12 (noon); hour 0 stays 0
  }
  return `${pad(hour)}:${pad(m)}`
}

type DateHit = { index: number; iso: string }

function findDates(text: string, year: number): DateHit[] {
  const hits: DateHit[] = []
  DATE_RE.lastIndex = 0
  for (const m of text.matchAll(DATE_RE)) {
    const idx = m.index ?? 0
    let day: number | undefined
    let month: number | undefined
    let y = year
    if (m[1] && m[2]) {
      // "16 Jan"
      day = Number(m[1])
      month = MONTHS[m[2].toLowerCase()]
    } else if (m[3] && m[4]) {
      // "Jan 16"
      month = MONTHS[m[3].toLowerCase()]
      day = Number(m[4])
    } else if (m[5] && m[6]) {
      // "01/16" or "01/16/26"
      month = Number(m[5])
      day = Number(m[6])
      if (m[7]) {
        const yy = Number(m[7])
        y = yy < 100 ? 2000 + yy : yy
      }
    }
    if (day && month && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      hits.push({ index: idx, iso: toIsoDate(y, month, day) })
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}

export function parseScheduleText(text: string, year: number): ParsedScheduleRow[] {
  const dates = findDates(text, year)
  if (dates.length === 0) return []

  const rows: ParsedScheduleRow[] = []
  ROW_RE.lastIndex = 0
  for (const m of text.matchAll(ROW_RE)) {
    const idx = m.index ?? 0
    const p1 = Number(m[1])
    const p2 = Number(m[2])
    if (!p1 || !p2 || p1 === p2 || p1 > 99 || p2 > 99) continue

    // Find the nearest date hit at or before this row.
    let date: DateHit | null = null
    let weekIndex = 0
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i].index <= idx) {
        date = dates[i]
        weekIndex = i + 1
        break
      }
    }
    if (!date) continue

    const startTime = m[3] ? normalizeTime(m[3], m[4]) : null
    const court = m[5] && !/^(am|pm)$/i.test(m[5]) ? m[5] : null

    rows.push({
      week_number: weekIndex,
      match_date: date.iso,
      start_time: startTime,
      court,
      player1_seed: p1,
      player2_seed: p2,
    })
  }
  return rows
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- parseScheduleText
```

Expected: 10 tests pass.

- [ ] **Step 5: Full suite**

```bash
npm test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: parseScheduleText pure function"
```

---

### Task 4: ImportLeague screen — file pick + parse

**Files:**
- Create: `src/leagues/ImportLeague.tsx`
- Modify: `src/shell/AppShell.tsx` (add /leagues/:id/import route)
- Modify: `src/leagues/League.tsx` (add "Import roster + schedule" link, admin-only)

The screen has three modes (driven by local state, no separate routes):
- `pick` — file input + year input + Process button
- `parsing` — spinner with progress
- `review` — uses ImportReview component (Task 5)

For this task, build the `pick` and `parsing` modes and surface the parsed results. The `review` mode comes in Task 5.

- [ ] **Step 1: Build ImportLeague (pick + parsing only)**

Create `src/leagues/ImportLeague.tsx`:

```tsx
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Tesseract from 'tesseract.js'
import { readPdfText } from '../lib/readPdfText'
import { parseRosterText, type ParsedRosterEntry } from '../lib/parseRosterText'
import { parseScheduleText, type ParsedScheduleRow } from '../lib/parseScheduleText'
import { useLeagueMembers } from './useLeagueMembers'
import { useLeagueSchedule } from './useLeagueSchedule'
import { ImportReview } from './ImportReview'

type Stage = 'pick' | 'parsing' | 'review'

export function ImportLeague() {
  const { id } = useParams<{ id: string }>()
  const { members: existingMembers } = useLeagueMembers(id ?? null)
  const { schedule: existingSchedule } = useLeagueSchedule(id ?? null)

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const [stage, setStage] = useState<Stage>('pick')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [parsedRoster, setParsedRoster] = useState<ParsedRosterEntry[]>([])
  const [parsedSchedule, setParsedSchedule] = useState<ParsedScheduleRow[]>([])

  async function handleFile(file: File) {
    setError(null)
    setStage('parsing')
    setProgress(0)
    try {
      let rosterText = ''
      let scheduleText = ''
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pages = await readPdfText(file)
        rosterText = pages[0] ?? ''
        scheduleText = pages[1] ?? pages[0] ?? ''
      } else {
        const { data } = await Tesseract.recognize(file, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
          },
        })
        rosterText = data.text
        scheduleText = data.text
      }

      setParsedRoster(parseRosterText(rosterText))
      setParsedSchedule(parseScheduleText(scheduleText, year))
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
      setStage('pick')
    }
  }

  if (!id) return <div className="p-4">Invalid league</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to={`/leagues/${id}`} className="text-emerald-300 text-sm">← League</Link>
        <h1 className="text-xl font-semibold">Import schedule</h1>
        <span className="w-10" />
      </div>

      {error && (
        <div className="bg-white rounded-2xl shadow p-3 text-red-600 text-sm">{error}</div>
      )}

      {stage === 'pick' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          {existingSchedule.length > 0 && (
            <p className="text-amber-700 text-sm">
              This league already has {existingSchedule.length} scheduled match{existingSchedule.length === 1 ? '' : 'es'}.
              Importing will add more rows. To replace, delete the existing schedule first.
            </p>
          )}
          <label className="block text-sm">
            Season year
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="block w-full rounded bg-emerald-600 text-white py-3 font-medium text-center cursor-pointer">
              Choose PDF or image
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </label>
          <p className="text-xs text-slate-500">
            PDFs parse fastest. Photos take ~10s (Tesseract OCR).
          </p>
        </div>
      )}

      {stage === 'parsing' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="text-sm text-slate-700">Reading file…</p>
          {progress > 0 && (
            <>
              <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-500">{progress}%</p>
            </>
          )}
        </div>
      )}

      {stage === 'review' && (
        <ImportReview
          leagueId={id}
          year={year}
          parsedRoster={parsedRoster}
          parsedSchedule={parsedSchedule}
          existingMembers={existingMembers}
          onCancel={() => setStage('pick')}
        />
      )}
    </div>
  )
}
```

This file references `ImportReview` which we'll create in Task 5. The build will fail until then — that's OK; we ship in two commits.

- [ ] **Step 2: Add route in AppShell**

In `src/shell/AppShell.tsx`, add `import { ImportLeague } from '../leagues/ImportLeague'` near the other league imports, and add `<Route path="/leagues/:id/import" element={<ImportLeague />} />` next to the other `/leagues` routes.

- [ ] **Step 3: Add admin link from League page**

In `src/leagues/League.tsx`, find the buttons/links section near the top (after the `← Leagues` link). When `isAdmin`, render a link to the import screen. The simplest placement: just below the header row, before the Standings card.

Find this block:

```tsx
      <div className="flex items-center justify-between">
        <Link to="/leagues" className="text-emerald-300 text-sm">← Leagues</Link>
        <h1 className="text-xl font-semibold">{league?.name ?? 'League'}</h1>
        <span className="w-10" />
      </div>

      <Standings leagueId={id} members={members} />
```

Insert between them:

```tsx
      {isAdmin && (
        <Link
          to={`/leagues/${id}/import`}
          className="block bg-white rounded-2xl shadow p-3 text-center font-medium text-emerald-700"
        >
          📄 Import roster + schedule
        </Link>
      )}
```

- [ ] **Step 4: Commit (build will be broken pending Task 5; expected)**

```bash
git add .
git commit -m "feat(wip): ImportLeague screen pick+parse stages"
```

---

### Task 5: ImportReview — editable two-section review + save

**Files:**
- Create: `src/leagues/ImportReview.tsx`

ImportReview takes the parsed data and lets the admin edit before bulk-saving.

- [ ] **Step 1: Build ImportReview**

Create `src/leagues/ImportReview.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ParsedRosterEntry } from '../lib/parseRosterText'
import type { ParsedScheduleRow } from '../lib/parseScheduleText'
import type { LeagueMember } from './useLeagueMembers'

type MemberRow = {
  include: boolean
  seed: number
  name: string
  phone: string
  email: string
  existingId: string | null
}

type ScheduleRow = {
  include: boolean
  week: number
  date: string
  time: string
  court: string
  p1Seed: number
  p2Seed: number
}

export function ImportReview({
  leagueId,
  year: _year,
  parsedRoster,
  parsedSchedule,
  existingMembers,
  onCancel,
}: {
  leagueId: string
  year: number
  parsedRoster: ParsedRosterEntry[]
  parsedSchedule: ParsedScheduleRow[]
  existingMembers: LeagueMember[]
  onCancel: () => void
}) {
  const navigate = useNavigate()

  // Build initial member rows. Parsed entries don't carry a seed — we
  // assign seeds in parse order starting from the next free seed in the league.
  const startSeed = existingMembers.length > 0
    ? Math.max(...existingMembers.map((m) => m.seed_number)) + 1
    : 1

  const initialMembers: MemberRow[] = useMemo(() => {
    return parsedRoster.map((r, i) => {
      const existing = existingMembers.find(
        (m) => m.name.trim().toLowerCase() === r.name.trim().toLowerCase(),
      )
      return {
        include: existing == null,
        seed: existing?.seed_number ?? startSeed + i,
        name: r.name,
        phone: r.phone ?? '',
        email: '',
        existingId: existing?.id ?? null,
      }
    })
  }, [parsedRoster, existingMembers, startSeed])

  const [members, setMembers] = useState<MemberRow[]>(initialMembers)
  const [schedule, setSchedule] = useState<ScheduleRow[]>(
    parsedSchedule.map((s) => ({
      include: true,
      week: s.week_number,
      date: s.match_date,
      time: s.start_time ?? '',
      court: s.court ?? '',
      p1Seed: s.player1_seed,
      p2Seed: s.player2_seed,
    })),
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateMember(i: number, patch: Partial<MemberRow>) {
    setMembers((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function updateSchedule(i: number, patch: Partial<ScheduleRow>) {
    setSchedule((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  // Map seed -> member id for the save step. After insertion, new members
  // get ids we need to resolve. We capture them in-flight.
  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      // 1. Insert new members
      const newMembers = members.filter((m) => m.include && !m.existingId && m.name.trim())
      let insertedById = new Map<number, string>()
      for (const m of newMembers) {
        const { data, error: insErr } = await supabase
          .from('league_members')
          .insert({
            league_id: leagueId,
            seed_number: m.seed,
            name: m.name.trim(),
            phone: m.phone.trim() || null,
            email: m.email.trim() || null,
            role: 'member',
          })
          .select('id, seed_number')
          .single()
        if (insErr) throw insErr
        insertedById.set(data.seed_number, data.id)
      }

      // 2. Build seed -> id map combining existing + just-inserted
      const seedToId = new Map<number, string>()
      for (const m of existingMembers) seedToId.set(m.seed_number, m.id)
      for (const [seed, mid] of insertedById) seedToId.set(seed, mid)
      // Also include members the user kept as "existingId" matches
      for (const m of members) {
        if (m.existingId) seedToId.set(m.seed, m.existingId)
      }

      // 3. Insert schedule rows
      const toInsert = schedule
        .filter((s) => s.include && s.date && s.p1Seed && s.p2Seed && s.p1Seed !== s.p2Seed)
        .map((s) => ({
          league_id: leagueId,
          week_number: s.week,
          match_date: s.date,
          start_time: s.time || null,
          court: s.court || null,
          player1_member_id: seedToId.get(s.p1Seed) ?? null,
          player2_member_id: seedToId.get(s.p2Seed) ?? null,
        }))

      if (toInsert.length > 0) {
        const { error: schedErr } = await supabase.from('league_schedule').insert(toInsert)
        if (schedErr) throw schedErr
      }

      navigate(`/leagues/${leagueId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const includedMemberCount = members.filter((m) => m.include).length
  const includedScheduleCount = schedule.filter((s) => s.include).length

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">
          Members ({includedMemberCount} to add, {members.filter((m) => m.existingId).length} already in league)
        </div>
        {members.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">No members detected. Add manually or retry with a clearer file.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m, i) => (
              <li key={i} className="p-2 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={m.include}
                    onChange={(e) => updateMember(i, { include: e.target.checked })}
                  />
                  <input
                    type="number"
                    value={m.seed}
                    onChange={(e) => updateMember(i, { seed: Number(e.target.value) })}
                    className="w-14 rounded border border-slate-300 px-1 py-1"
                    disabled={!!m.existingId}
                  />
                  <input
                    value={m.name}
                    onChange={(e) => updateMember(i, { name: e.target.value })}
                    className="flex-1 rounded border border-slate-300 px-2 py-1"
                    disabled={!!m.existingId}
                  />
                  {m.existingId && <span className="text-xs text-slate-400">(existing)</span>}
                </div>
                {!m.existingId && (
                  <div className="flex gap-2">
                    <input
                      value={m.phone}
                      placeholder="Phone"
                      onChange={(e) => updateMember(i, { phone: e.target.value })}
                      className="flex-1 rounded border border-slate-300 px-2 py-1"
                    />
                    <input
                      value={m.email}
                      placeholder="Email (optional)"
                      onChange={(e) => updateMember(i, { email: e.target.value })}
                      className="flex-1 rounded border border-slate-300 px-2 py-1"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">
          Schedule ({includedScheduleCount} to add)
        </div>
        {schedule.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">No schedule rows detected.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schedule.map((s, i) => (
              <li key={i} className="p-2 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.include}
                    onChange={(e) => updateSchedule(i, { include: e.target.checked })}
                  />
                  <span className="text-xs text-slate-400">Wk {s.week}</span>
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) => updateSchedule(i, { date: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-1"
                  />
                  <input
                    type="time"
                    value={s.time}
                    onChange={(e) => updateSchedule(i, { time: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-1 w-24"
                  />
                  <input
                    value={s.court}
                    placeholder="Court"
                    onChange={(e) => updateSchedule(i, { court: e.target.value })}
                    className="rounded border border-slate-300 px-1 py-1 w-14"
                  />
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-slate-500 text-xs">P1</span>
                  <input
                    type="number"
                    value={s.p1Seed}
                    onChange={(e) => updateSchedule(i, { p1Seed: Number(e.target.value) })}
                    className="w-14 rounded border border-slate-300 px-1 py-1"
                  />
                  <span className="text-slate-500 text-xs">vs P2</span>
                  <input
                    type="number"
                    value={s.p2Seed}
                    onChange={(e) => updateSchedule(i, { p2Seed: Number(e.target.value) })}
                    className="w-14 rounded border border-slate-300 px-1 py-1"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || (includedMemberCount === 0 && includedScheduleCount === 0)}
          className="flex-1 rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : `Save ${includedMemberCount} + ${includedScheduleCount}`}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded border border-slate-300 bg-white py-3 font-medium"
        >
          Re-pick file
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: clean. (The Task 4 commit's broken build is now fixed.)

- [ ] **Step 3: Run full test suite to confirm nothing broke**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: ImportReview screen for league import"
```

---

### Task 6: Deploy + verify

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Smoke test on phone**

After Vercel finishes:

1. Refresh PWA.
2. More → Leagues → tap your test league → "📄 Import roster + schedule".
3. Pick the league PDF you have. Season year defaults to current year.
4. Review screen should show parsed members + schedule. Edit anything that looks off.
5. Tap Save. Lands back on the league page.
6. Standings + Schedule sections show the new data.

Also try with a photo of a printed schedule to confirm Tesseract path works.

- [ ] **Step 3: Tag**

```bash
git tag plan-schedule-import-complete
git push --tags
```

---

## Self-Review

Coverage against the spec:

- ✅ Upload location inside league page (admin only) — Task 4 Step 3
- ✅ PDF path via `readPdfText` (pdfjs-dist) — Task 1
- ✅ Photo path via Tesseract — Task 4 (reuses existing dep)
- ✅ `parseRosterText` (promoted from parseSchedulePhoto) — Task 2
- ✅ `parseScheduleText` (year + date parsing + bare-time-as-PM convention) — Task 3
- ✅ Two-section editable review (members + schedule) — Task 5
- ✅ Bulk insert league_members + league_schedule — Task 5 handleSave
- ✅ "Already exists" warning for existing schedule — Task 4 ImportLeague pick stage
- ✅ Year input — Task 4
- ✅ Deploy + smoke test — Task 6

Out of scope (per spec):
- Re-import / merge with existing schedule
- Multi-image upload
- Tournament brackets (semifinals / finals)

Type consistency check:
- `ParsedRosterEntry` shape: `{ name, phone }` — used in Task 2 (promotion), Task 5 (ImportReview).
- `ParsedScheduleRow` shape: `{ week_number, match_date, start_time, court, player1_seed, player2_seed }` — defined Task 3, consumed Task 5.
- `LeagueMember.id` reference: schedule rows save `player1_member_id` and `player2_member_id` from the seed→id map.
- The existing `parseSchedulePhoto` import in `src/contacts/ImportContacts.tsx` keeps working via the re-export shim in Task 2 Step 3.

No placeholders found.
