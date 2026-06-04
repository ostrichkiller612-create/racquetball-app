import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Tesseract from 'tesseract.js'
import { useContacts } from './useContacts'
import { parseSchedulePhoto, type ParsedContact } from './parseSchedulePhoto'

type Row = ParsedContact & { include: boolean }

export function ImportContacts() {
  const { addContact } = useContacts()
  const navigate = useNavigate()

  const [stage, setStage] = useState<'pick' | 'ocr' | 'review' | 'saving'>('pick')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [rawText, setRawText] = useState('')

  async function handleFile(file: File) {
    setError(null)
    setStage('ocr')
    setProgress(0)
    try {
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })
      const text = data.text
      setRawText(text)
      const parsed = parseSchedulePhoto(text)
      setRows(parsed.map((p) => ({ ...p, include: true })))
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed')
      setStage('pick')
    }
  }

  async function handleSave() {
    setStage('saving')
    setError(null)
    try {
      for (const r of rows) {
        if (!r.include || !r.name.trim()) continue
        await addContact({ name: r.name.trim(), phone: r.phone })
      }
      navigate('/contacts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setStage('review')
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/contacts" className="text-emerald-300 text-sm">← Contacts</Link>
        <h1 className="text-xl font-semibold">Import from photo</h1>
        <span className="w-10" />
      </div>

      {error && (
        <div className="bg-white rounded-2xl shadow p-3 text-red-600 text-sm">{error}</div>
      )}

      {stage === 'pick' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="text-sm text-slate-600">
            Take a photo of the league sheet — names and phone numbers will be extracted.
            You'll review and edit before saving.
          </p>
          <label className="block">
            <span className="block w-full rounded bg-emerald-600 text-white py-3 font-medium text-center cursor-pointer">
              Take photo / choose image
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </label>
        </div>
      )}

      {stage === 'ocr' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="text-sm text-slate-700">Reading photo…</p>
          <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">{progress}%</p>
        </div>
      )}

      {stage === 'review' && (
        <>
          <div className="bg-white rounded-2xl shadow p-3 text-sm">
            <p className="text-slate-700 mb-2">
              Found {rows.length} {rows.length === 1 ? 'row' : 'rows'}. Review and edit, then save.
            </p>
            {rows.length === 0 && (
              <p className="text-slate-500">
                Nothing was extracted. Try a clearer photo, or add contacts manually.
              </p>
            )}
          </div>

          {rows.map((r, i) => (
            <div key={i} className="bg-white rounded-2xl shadow p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => updateRow(i, { include: e.target.checked })}
                  className="w-4 h-4"
                />
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="Name"
                />
              </div>
              <input
                type="text"
                value={r.phone ?? ''}
                onChange={(e) => updateRow(i, { phone: e.target.value || null })}
                className="block w-full rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="Phone (optional)"
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={rows.filter((r) => r.include).length === 0}
              className="flex-1 rounded bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
            >
              Save {rows.filter((r) => r.include).length} contacts
            </button>
            <button
              onClick={() => setStage('pick')}
              className="flex-1 rounded border border-slate-300 bg-white py-2 font-medium"
            >
              Retake
            </button>
          </div>

          <details className="text-xs text-slate-300">
            <summary>Raw OCR text (debug)</summary>
            <pre className="mt-2 bg-white rounded p-2 whitespace-pre-wrap text-slate-700">{rawText}</pre>
          </details>
        </>
      )}

      {stage === 'saving' && (
        <div className="bg-white rounded-2xl shadow p-4 text-sm">Saving…</div>
      )}
    </div>
  )
}
