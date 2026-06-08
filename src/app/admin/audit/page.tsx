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

  const toggleDay = useCallback((dateKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }, [])

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true)
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
      }
    }

    fetchLogs()
  }, [])

  if (loading) {
    return (
      <div>
        <PageHeader title="Audit Log History" subtitle="Track all admin and system activity (last 14 days)" />
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-12 text-center text-[#71717a] text-sm">Loading audit logs...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Audit Log History" subtitle="Track all admin and system activity (last 14 days)" />
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-12 text-center text-red-400 text-sm">{error}</div>
      </div>
    )
  }

  const totalEntries = weekGroups.reduce((s, w) => s + w.dayGroups.reduce((s2, d) => s2 + d.logs.length, 0), 0)

  return (
    <div>
      <PageHeader title="Audit Log History" subtitle="Track all admin and system activity (last 14 days)" />
      {totalEntries === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-12 text-center text-[#71717a] text-sm">No audit logs found in the last 14 days.</div>
      ) : (
        <div className="space-y-8">
          {weekGroups.map(week => {
            const weekTotal = week.dayGroups.reduce((s, d) => s + d.logs.length, 0)
            return (
              <div key={week.weekStart}>
                <h2 className="text-sm font-bold text-white mb-3 px-1">Week of {formatWeekStart(week.weekStart)} — {weekTotal} entries</h2>
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
                                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.logs.map(log => (
                                <tr key={log.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                                  <td className="px-4 py-3 text-xs text-[#71717a] whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                                  <td className="px-4 py-3 text-sm text-white">{log.profiles?.full_name || 'System'}</td>
                                  <td className="px-4 py-3"><span className="text-xs bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-0.5 rounded-md">{log.action}</span></td>
                                  <td className="px-4 py-3 text-sm text-[#a1a1aa]">{(log.entity_type || '').replace(/_/g, ' ')}</td>
                                  <td className="px-4 py-3 text-xs text-[#71717a] font-mono">{log.entity_id || '—'}</td>
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
