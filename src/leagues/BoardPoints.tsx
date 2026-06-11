import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Tesseract from 'tesseract.js'
import { supabase } from '../lib/supabase'
import { useLeagueMembers } from './useLeagueMembers'
import { parseBoardPoints } from './parseBoardPoints'

export function BoardPoints() {
  const { id } = useParams<{ id: string }>()
  const { members, loading } = useLeagueMembers(id ?? null)
  const navigate = useNavigate()

  // memberId -> input string ('' = no value)
  const [values, setValues] = useState<Map<string, string>>(new Map())
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed inputs from current board_points once members load.
  useEffect(() => {
    if (members.length === 0) return
    setValues((prev) => {
      if (prev.size > 0) return prev
      return new Map(
        members.map((m) => [m.id, m.board_points != null ? String(m.board_points) : '']),
      )
    })
  }, [members])

  async function handlePhoto(file: File) {
    setError(null)
    setScanNote(null)
    setScanning(true)
    setProgress(0)
    try {
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })
      const hits = parseBoardPoints(data.text, members)
      if (hits.size === 0) {
        setScanNote('Could not read any names/numbers from the photo — enter them below.')
      } else {
        setValues((prev) => {
          const next = new Map(prev)
          for (const [memberId, pts] of hits) next.set(memberId, String(pts))
          return next
        })
        setScanNote(
          `Read ${hits.size} of ${members.length} from the photo — check them and fill in the rest.`,
        )
      }
    } catch (err) {
      console.error('Board photo scan failed:', err)
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      for (const m of members) {
        const raw = (values.get(m.id) ?? '').trim()
        const parsed = raw === '' ? null : Number(raw)
        if (parsed !== null && !Number.isFinite(parsed)) continue
        const changed = (m.board_points ?? null) !== parsed
        if (!changed) continue
        const { error: upErr } = await supabase
          .from('league_members')
          .update({ board_points: parsed, board_updated_at: now })
          .eq('id', m.id)
        if (upErr) {
          throw new Error(`${m.name}: ${upErr.message}`)
        }
      }
      navigate(`/leagues/${id}`)
    } catch (err) {
      console.error('Board points save failed:', err)
      setError(err instanceof Error ? err.message : JSON.stringify(err))
      setSaving(false)
    }
  }

  if (!id) return <div className="p-4">Invalid league</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to={`/leagues/${id}`} className="text-emerald-300 text-sm">← League</Link>
        <h1 className="text-xl font-semibold">Board points</h1>
        <span className="w-10" />
      </div>

      {error && (
        <div className="bg-white rounded-2xl shadow p-3 text-red-600 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow p-3 space-y-2">
        <label className="block">
          <span className="block w-full rounded border border-emerald-500 text-emerald-700 py-2 font-medium text-center cursor-pointer">
            📷 Pre-fill from photo
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handlePhoto(f)
            }}
          />
        </label>
        {scanning && (
          <div className="space-y-1">
            <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
              <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-slate-500">Reading photo… {progress}%</p>
          </div>
        )}
        {scanNote && <p className="text-xs text-slate-600">{scanNote}</p>}
        <p className="text-xs text-slate-400">
          Handwriting is hard to read automatically — treat the photo as a head start, not gospel.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow">
        <div className="px-4 py-2 text-sm font-medium text-slate-600 border-b">
          Official totals
        </div>
        {loading ? (
          <p className="p-3 text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <span>
                  <span className="text-slate-400 w-6 inline-block">#{m.seed_number}</span>
                  <span className="font-medium">{m.name}</span>
                </span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values.get(m.id) ?? ''}
                  onChange={(e) =>
                    setValues((prev) => new Map(prev).set(m.id, e.target.value))
                  }
                  placeholder="—"
                  className="w-20 rounded border border-slate-300 px-2 py-1 text-right"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="w-full rounded bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save board points'}
      </button>
    </div>
  )
}
