import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

export function Share() {
  const url = window.location.origin
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API not available — silently ignore
    }
  }

  return (
    <div className="p-6 flex flex-col items-center space-y-4">
      <h1 className="text-xl font-semibold">Share</h1>
      <p className="text-sm text-slate-600 text-center max-w-xs">
        Scan this code to open the app and sign in.
      </p>
      <div className="bg-white p-4 rounded-2xl shadow">
        <QRCodeSVG value={url} size={224} level="M" />
      </div>
      <button
        onClick={handleCopy}
        className="text-sm text-emerald-700 underline break-all text-center max-w-xs"
      >
        {copied ? 'Copied!' : url}
      </button>
    </div>
  )
}
