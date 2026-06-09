'use client'

import { useEffect, useState, useCallback } from 'react'
import PageHeader from '@/components/PageHeader'
import { formatDate, formatDateTime } from '@/lib/format'

interface AuditLog {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string | null
  user_id: string | null
  profiles: { full_name?: string } | null
}

interface DayGroup {
  label: string
  dateKey: string
  logs: AuditLog[]
}

interface WeekGroup {
  weekStart: string
  dayGroups: DayGroup[]
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const d = date.toDateString()
  const t = today.toDateString()
  const y = yesterday.toDateString()

  if (d === t) return 'Today'
  if (d === y) return 'Yesterday'
  return formatDate(dateStr)
}

function getDateKey(dateStr: string): string {
  return new Date(dateStr).toDateString()
}

function formatWeekStart(isoStr: string): string {
  const d = new Date(isoStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function AuditLogHistoryPage() {
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([])
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const toggleDay = useCallback((dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }, [])

  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true)
      const res = await fetch('/api/audit')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load audit logs')
      const { data: logsData } = await res.json()

      const logs = (logsData || []) as AuditLog[]
      const groups: WeekGroup[] = []

      for (const log of logs) {
        const weekStart = getWeekStart(new Date(log.created_at))
        const dayLabel = getDayLabel(log.created_at)
        const dateKey = getDateKey(log.created_at)

        let weekGroup = groups.find(w => w.weekStart === weekStart)
        if (!weekGroup) {
          weekGroup = { weekStart, dayGroups: [] }
          groups.push(weekGroup)
        }

        let dayGroup = weekGroup.dayGroups.find(d => d.dateKey === dateKey)
        if (!dayGroup) {
          dayGroup = { label: dayLabel, dateKey, logs: [] }
          weekGroup.dayGroups.push(dayGroup)
        }

        dayGroup.logs.push(log)
      }

      // Expand the first day by default
      if (groups.length > 0 && groups[0].dayGroups.length > 0) {
        setExpandedDays(new Set([groups[0].dayGroups[0].dateKey]))
      }

      setWeekGroups(groups)
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalEntries = weekGroups.reduce((s, w) => s + w.dayGroups.reduce((s2, d) => s2 + d.logs.length, 0), 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title="Audit Log History" subtitle="Track all admin and system activity (last 14 days)">
        <button onClick={() => fetchLogs(true)} disabled={loading || refreshing}
          className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2">
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </PageHeader>
      {loading ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-12 text-center text-[#71717a] text-sm">Loading audit logs...</div>
      ) : error ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-12 text-center text-red-400 text-sm">{error}</div>
      ) : totalEntries === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-12 text-center text-[#71717a] text-sm">No audit logs found in the last 14 days.</div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-8 pr-1">
          {weekGroups.map(week => {
            const weekTotal = week.dayGroups.reduce((s, d) => s + d.logs.length, 0)
            return (
              <div key={week.weekStart}>
                <h2 className="text-sm font-bold text-white mb-3 px-1 sticky top-0 bg-[#0a0a0a] z-10 py-2">Week of {formatWeekStart(week.weekStart)} — {weekTotal} entries</h2>
                <div className="space-y-3">
                  {week.dayGroups.map(group => (
                    <div key={group.dateKey} className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
                      <button
                        onClick={() => toggleDay(group.dateKey)}
                        className="w-full px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-between hover:bg-[#222] transition-colors text-left"
                      >
                        <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                        <span className="text-xs text-[#71717a]">
                          {group.logs.length} {group.logs.length === 1 ? 'entry' : 'entries'}
                          <span className="ml-2">{expandedDays.has(group.dateKey) ? '▲' : '▼'}</span>
                        </span>
                      </button>
                      {expandedDays.has(group.dateKey) && (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[#2a2a2a]">
                                {['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID'].map(h => (
                                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.logs.map(log => (
                                <tr key={log.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                                  <td className="px-4 py-3 text-xs text-[#71717a] whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                                  <td className="px-4 py-3 text-sm text-white whitespace-nowrap">{log.profiles?.full_name || 'System'}</td>
                                  <td className="px-4 py-3"><span className="text-xs bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-0.5 rounded-md whitespace-nowrap">{log.action}</span></td>
                                  <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{(log.entity_type || '').replace(/_/g, ' ')}</td>
                                  <td className="px-4 py-3 text-xs text-[#71717a] font-mono max-w-[200px] truncate" title={log.entity_id || ''}>{log.entity_id || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
