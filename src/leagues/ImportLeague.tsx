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
      console.error('Import parse failed:', err)
      const msg = err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err)
      setError(`Parse failed — ${msg}`)
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
