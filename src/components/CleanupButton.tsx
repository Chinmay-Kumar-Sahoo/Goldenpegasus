'use client'

import { useState } from 'react'

export default function CleanupButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleClick = async () => {
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/marketing-cleanup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Cleanup failed')
      setResult(json)
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setRunning(false)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={running}
        className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a1a] transition-colors text-sm text-[#a1a1aa] hover:text-white group w-full text-left"
      >
        <span>{running ? '⏳' : '🧹'}</span>
        <span>{running ? 'Cleaning...' : 'Run Database Cleanup'}</span>
        <span className="ml-auto text-[#3a3a3a] group-hover:text-[#22c55e] transition-colors">→</span>
      </button>
      {result && !result.error && (
        <div className="mt-2 px-3 text-xs text-[#a1a1aa] space-y-0.5">
          <div>Marketing: {result.marketing?.nameUpdated ?? 0} names, {result.marketing?.techUpdated ?? 0} tech, {result.marketing?.companyNameUpdated ?? 0} companies, {result.marketing?.emailCleared ?? 0} emails, {result.marketing?.dupesRemoved ?? 0} dupes removed</div>
          <div>Candidates: {result.candidates?.nameUpdated ?? 0} names, {result.candidates?.techUpdated ?? 0} tech, {result.candidates?.dupesRemoved ?? 0} dupes removed</div>
        </div>
      )}
      {result?.error && (
        <div className="mt-2 px-3 text-xs text-red-400">Error: {result.error}</div>
      )}
    </div>
  )
}
