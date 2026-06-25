'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import PageHeader from '@/components/PageHeader'
import { formatDate, formatDateTime } from '@/lib/dates'

interface AuditLog {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string | null
  user_id: string | null
  profiles: { full_name?: string } | null
}

interface DaySummary {
  label: string
  dateKey: string
  dateParam: string
  count: number
  logs?: AuditLog[]
}

interface WeekGroup {
  weekStart: string
  dayGroups: DaySummary[]
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

function todayDateParam(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AuditLogHistoryPage() {
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([])
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [dayLogs, setDayLogs] = useState<Record<string, AuditLog[]>>({})
  const [loadingDay, setLoadingDay] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const dayLogsRef = useRef(dayLogs)
  dayLogsRef.current = dayLogs

  const fetchDay = useCallback(async (dateKey: string, dateParam: string) => {
    if (dayLogsRef.current[dateKey]) return // already loaded
    setLoadingDay(prev => ({ ...prev, [dateKey]: true }))
    try {
      const res = await fetch(`/api/audit?date=${dateParam}`)
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
      const { data } = await res.json()
      setDayLogs(prev => ({ ...prev, [dateKey]: data || [] }))
    } catch {
      setDayLogs(prev => ({ ...prev, [dateKey]: [] }))
    } finally {
      setLoadingDay(prev => ({ ...prev, [dateKey]: false }))
    }
  }, [])

  const toggleDay = useCallback((dateKey: string, dateParam: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateKey)) {
        next.delete(dateKey)
      } else {
        next.add(dateKey)
        fetchDay(dateKey, dateParam)
      }
      return next
    })
  }, [fetchDay])

  const buildWeekGroups = useCallback((summary: Record<string, number>): WeekGroup[] => {
    const groups: WeekGroup[] = []
    const sortedDays = Object.keys(summary).sort().reverse()

    for (const dayStr of sortedDays) {
      const weekStart = getWeekStart(new Date(dayStr))
      const dayLabel = getDayLabel(dayStr)
      const dateKey = getDateKey(dayStr)

      let weekGroup = groups.find(w => w.weekStart === weekStart)
      if (!weekGroup) {
        weekGroup = { weekStart, dayGroups: [] }
        groups.push(weekGroup)
      }

      weekGroup.dayGroups.push({
        label: dayLabel,
        dateKey,
        dateParam: dayStr,
        count: summary[dayStr],
      })
    }

    return groups
  }, [])

  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true)
      setError('')
      setDayLogs({})
      setExpandedDays(new Set())

      const res = await fetch('/api/audit?summary=true')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load audit logs')
      const { summary } = await res.json()

      if (!summary || Object.keys(summary).length === 0) {
        setWeekGroups([])
        return
      }

      const groups = buildWeekGroups(summary)
      setWeekGroups(groups)

      // Auto-expand today
      const todayParam = todayDateParam()
      if (summary[todayParam]) {
        const todayKey = getDateKey(todayParam)
        setExpandedDays(new Set([todayKey]))
        fetchDay(todayKey, todayParam)
      } else if (groups.length > 0 && groups[0].dayGroups.length > 0) {
        const first = groups[0].dayGroups[0]
        setExpandedDays(new Set([first.dateKey]))
        fetchDay(first.dateKey, first.dateParam)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [buildWeekGroups, fetchDay])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalEntries = weekGroups.reduce((s, w) => s + w.dayGroups.reduce((s2, d) => s2 + d.count, 0), 0)

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
            const weekTotal = week.dayGroups.reduce((s, d) => s + d.count, 0)
            return (
              <div key={week.weekStart}>
                <h2 className="text-sm font-bold text-white mb-3 px-1 sticky top-0 bg-[#0a0a0a] z-10 py-2">Week of {formatWeekStart(week.weekStart)} — {weekTotal} entries</h2>
                <div className="space-y-3">
                  {week.dayGroups.map(group => {
                    const logs = dayLogs[group.dateKey]
                    const isLoading = loadingDay[group.dateKey]
                    const isExpanded = expandedDays.has(group.dateKey)
                    return (
                      <div key={group.dateKey} className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
                        <button
                          onClick={() => toggleDay(group.dateKey, group.dateParam)}
                          className="w-full px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-between hover:bg-[#222] transition-colors text-left"
                        >
                          <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                          <span className="text-xs text-[#71717a]">
                            {group.count} {group.count === 1 ? 'entry' : 'entries'}
                            <span className="ml-2">{isExpanded ? '▲' : '▼'}</span>
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="overflow-x-auto">
                            {isLoading ? (
                              <div className="px-4 py-6 text-center text-[#71717a] text-sm">Loading entries...</div>
                            ) : logs && logs.length > 0 ? (
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-[#2a2a2a]">
                                    {['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID'].map(h => (
                                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {logs.map(log => (
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
                            ) : (
                              <div className="px-4 py-6 text-center text-[#71717a] text-sm">No entries found for this day.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
