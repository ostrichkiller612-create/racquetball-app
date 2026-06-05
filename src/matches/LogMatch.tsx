import { useState } from 'react'
import { LogSingles } from './LogSingles'
import { LogCutthroat } from './LogCutthroat'
import { LogDoubles } from './LogDoubles'

type MatchType = 'singles' | 'cutthroat' | 'doubles'

const TABS: Array<{ id: MatchType; label: string }> = [
  { id: 'singles', label: 'Singles' },
  { id: 'cutthroat', label: 'Cutthroat' },
  { id: 'doubles', label: 'Doubles' },
]

export function LogMatch() {
  const [type, setType] = useState<MatchType>('singles')

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Log Match</h1>

      <div className="flex bg-white rounded-2xl shadow p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium ${
              type === t.id ? 'bg-emerald-600 text-white' : 'text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === 'singles' && <LogSingles />}
      {type === 'cutthroat' && <LogCutthroat />}
      {type === 'doubles' && <LogDoubles />}
    </div>
  )
}
