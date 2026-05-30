import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import { formatDateTime } from '@/lib/format'

export const metadata = { title: 'Audit Logs | Admin | GoldenPegasus' }

export default async function AuditLogsPage() {
  const supabase = await createClient()

  const { data: logsData } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100)

  const entityIds = [...new Set((logsData || []).filter(l => l.entity_type === 'employee' || l.action.startsWith('employee_created')).map(l => l.entity_id).filter(Boolean))]

  let entityProfiles: Record<string, { email_confirmed_at: string | null }> = {}
  if (entityIds.length > 0) {
    const { data: eps } = await supabase.from('profiles').select('id, email_confirmed_at').in('id', entityIds)
    for (const ep of eps || []) {
      entityProfiles[ep.id] = ep
    }
  }

  const logs = (logsData || []).map(log => ({
    ...log,
    entity_profile: log.entity_id ? entityProfiles[log.entity_id] : null,
  }))

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Track all admin and system activity" />
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
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
              {!logs || logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[#71717a] text-sm">No audit logs found.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#71717a] whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-white">{(log.profiles as {full_name?: string})?.full_name || 'System'}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-0.5 rounded-md">{log.action}</span></td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{log.entity_type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#71717a] font-mono">{log.entity_id || '—'}</td>
                    <td className="px-4 py-3">
                      {log.entity_profile?.email_confirmed_at ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-bold uppercase tracking-wider">Confirmed</span>
                      ) : log.entity_profile ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold uppercase tracking-wider">Pending</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#2a2a2a] text-xs text-[#71717a]">{logs?.length || 0} log entries</div>
      </div>
    </div>
  )
}
