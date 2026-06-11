import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export function InviteCard({ leagueId }: { leagueId: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/join/${leagueId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — the link is visible to copy manually
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 text-left font-medium text-emerald-700"
      >
        📨 Invite players {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 flex flex-col items-center">
          <p className="text-xs text-slate-500 text-center">
            Have them scan this — they sign in, tap their name on the roster, and
            they're connected to their schedule and results.
          </p>
          <QRCodeSVG value={url} size={180} level="M" />
          <button
            onClick={copy}
            className="text-sm text-emerald-700 underline break-all text-center"
          >
            {copied ? 'Copied!' : url}
          </button>
        </div>
      )}
    </div>
  )
}
