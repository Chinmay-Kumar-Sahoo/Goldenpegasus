import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import { formatDateTime } from '@/lib/format'

export const metadata = { title: 'Audit Logs | Admin | GoldenPegasus' }

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toDateString()
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
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AuditLogsPage() {
  const supabase = await createClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: logsData } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name, email)')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })

  const entityNames: Record<string, string> = {}
  const entityProfiles: Record<string, { email_confirmed_at: string | null }> = {}

  const employeeIds = [...new Set((logsData || []).filter(l => l.entity_type === 'employee').map(l => l.entity_id).filter(Boolean))]
  const marketingIds = [...new Set((logsData || []).filter(l => l.entity_type === 'marketing_record').map(l => l.entity_id).filter(Boolean))]
  const candidateIds = [...new Set((logsData || []).filter(l => l.entity_type === 'candidate_record').map(l => l.entity_id).filter(Boolean))]

  if (employeeIds.length > 0) {
    const { data: eps } = await supabase.from('profiles').select('id, full_name, email_confirmed_at').in('id', employeeIds)
    for (const ep of eps || []) {
      entityProfiles[ep.id] = ep
      entityNames[ep.id] = ep.full_name || ep.id
    }
  }
  if (marketingIds.length > 0) {
    const { data: mrs } = await supabase.from('marketing_records').select('id, name').in('id', marketingIds)
    for (const mr of mrs || []) entityNames[mr.id] = mr.name || mr.id
  }
  if (candidateIds.length > 0) {
    const { data: crs } = await supabase.from('Candidate_records').select('id, Candidate_name').in('id', candidateIds)
    for (const cr of crs || []) entityNames[cr.id] = cr.Candidate_name || cr.id
  }

  const logs = (logsData || []).map(log => ({
    ...log,
    entity_name: log.entity_id ? entityNames[log.entity_id] : null,
    entity_profile: log.entity_id ? entityProfiles[log.entity_id] : null,
  }))

  type LogItem = (typeof logs)[number]

  const weekGroups: { weekStart: string; dayGroups: { label: string; logs: LogItem[] }[] }[] = []

  for (const log of logs) {
    const weekStart = getWeekStart(new Date(log.created_at!))
    const dayLabel = getDayLabel(log.created_at!)

    let weekGroup = weekGroups.find(w => w.weekStart === weekStart)
    if (!weekGroup) {
      weekGroup = { weekStart, dayGroups: [] }
      weekGroups.push(weekGroup)
    }

    let dayGroup = weekGroup.dayGroups.find(d => d.label === dayLabel)
    if (!dayGroup) {
      dayGroup = { label: dayLabel, logs: [] }
      weekGroup.dayGroups.push(dayGroup)
    }

    dayGroup.logs.push(log)
  }

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Track all admin and system activity (last 7 days)" />
      {logs.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-12 text-center text-[#71717a] text-sm">No audit logs found in the last 7 days.</div>
      ) : (
        <div className="space-y-8">
          {weekGroups.map(week => {
            const weekTotal = week.dayGroups.reduce((s, d) => s + d.logs.length, 0)
            return (
              <div key={week.weekStart}>
                <h2 className="text-sm font-bold text-white mb-3 px-1">Week of {week.weekStart.slice(4)} — {weekTotal} entries</h2>
                <div className="space-y-4">
                  {week.dayGroups.map(group => (
                    <div key={group.label} className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">
                        <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#2a2a2a]">
                              {['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Status'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.logs.map(log => (
                              <tr key={log.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                                <td className="px-4 py-3 text-xs text-[#71717a] whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                                <td className="px-4 py-3 text-sm text-white">{(log.profiles as { full_name?: string })?.full_name || 'System'}</td>
                                <td className="px-4 py-3"><span className="text-xs bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-0.5 rounded-md">{log.action}</span></td>
                                 <td className="px-4 py-3 text-sm text-[#a1a1aa]">{(log.entity_type || '').replace(/_/g, ' ')}</td>
                                 <td className="px-4 py-3 text-xs text-[#71717a]">
                                   {log.entity_name ? (
                                     <span className="text-white font-medium">{log.entity_name}</span>
                                   ) : log.entity_id ? (
                                     <span className="font-mono">{log.entity_id}</span>
                                   ) : '—'}
                                 </td>
                                <td className="px-4 py-3">
                                  {log.entity_profile?.email_confirmed_at ? (
                                    <span className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-bold uppercase tracking-wider">Confirmed</span>
                                  ) : log.entity_profile ? (
                                    <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold uppercase tracking-wider">Pending</span>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 border-t border-[#2a2a2a] text-xs text-[#71717a]">{group.logs.length} entries</div>
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
