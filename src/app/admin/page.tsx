import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import Link from 'next/link'
import { formatDateTime } from '@/lib/format'

export const metadata = { title: 'Admin Dashboard | GoldenPegasus' }

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ count: employeeCount }, { count: adminCount }, { count: mktCount }, { count: tableCount }, { count: baseCount }, { data: recentLogs }, { data: clientRaw }] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employee'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('marketing_records').select('*', { count: 'exact', head: true }),
      supabase.from('dynamic_tables').select('*', { count: 'exact', head: true }),
      supabase.from('base_technologies').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('action, entity_type, entity_id, created_at, user_id, profiles(full_name)').gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()).order('created_at', { ascending: false }),
      supabase.from('Candidate_records').select('Candidate_name, technology'),
    ])
  const uniqueClients = new Set((clientRaw || []).map((r: any) => ((r.Candidate_name || '') + '|' + (r.technology || '')).toLowerCase().trim()).filter(Boolean))
  const clientCount = uniqueClients.size

  const entityNames: Record<string, string> = {}
  const employeeIds = [...new Set((recentLogs || []).filter(l => l.entity_type === 'employee').map(l => l.entity_id).filter(Boolean))]
  const marketingIds = [...new Set((recentLogs || []).filter(l => l.entity_type === 'marketing_record').map(l => l.entity_id).filter(Boolean))]
  const candidateIds = [...new Set((recentLogs || []).filter(l => l.entity_type === 'candidate_record').map(l => l.entity_id).filter(Boolean))]

  if (employeeIds.length > 0) {
    const { data: eps } = await supabase.from('profiles').select('id, full_name').in('id', employeeIds)
    for (const ep of eps || []) entityNames[ep.id] = ep.full_name || ep.id
  }
  if (marketingIds.length > 0) {
    const { data: mrs } = await supabase.from('marketing_records').select('id, name').in('id', marketingIds)
    for (const mr of mrs || []) entityNames[mr.id] = mr.name || mr.id
  }
  if (candidateIds.length > 0) {
    const { data: crs } = await supabase.from('Candidate_records').select('id, Candidate_name').in('id', candidateIds)
    for (const cr of crs || []) entityNames[cr.id] = cr.Candidate_name || cr.id
  }

  const stats = [
    { label: 'Employees', value: employeeCount ?? 0, icon: '👥', href: '/admin/employees' },
    { label: 'Admins', value: adminCount ?? 0, icon: '🔑', href: '/admin/admins', color: 'blue' },
    { label: 'Marketing Records', value: mktCount ?? 0, icon: '📈', href: '/admin/marketing', color: 'green' },
    { label: 'Client Records', value: clientCount ?? 0, icon: '🤝', href: '/admin/clients', color: 'purple' },
    { label: 'Dynamic Tables', value: tableCount ?? 0, icon: '🏗️', href: '/admin/tables', color: 'yellow' },
    { label: 'Base Table', value: baseCount ?? 0, icon: '📋', href: '/admin/base-table', color: 'blue' },
  ]

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Full system overview and control center"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-5 hover:border-[#22c55e]/30 hover:bg-[#1a1a1a] transition-all duration-200 group"
          >
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-[#71717a]">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Add Employee', href: '/admin/employees?action=new', icon: '➕' },
              { label: 'Create Dynamic Table', href: '/admin/tables?action=new', icon: '🏗️' },
              { label: 'View All Marketing', href: '/admin/marketing', icon: '📈' },
              { label: 'View Audit Log History', href: '/admin/audit', icon: '📋' },
            ].map(action => (
              <Link key={action.label} href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1a1a1a] transition-colors text-sm text-[#a1a1aa] hover:text-white group">
                <span>{action.icon}</span>
                <span>{action.label}</span>
                <span className="ml-auto text-[#3a3a3a] group-hover:text-[#22c55e] transition-colors">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Recent Audit Activity</h2>
          {recentLogs && recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log, i) => {
                const entityName = log.entity_id ? entityNames[log.entity_id] : null
                const entityLabel = log.entity_type?.replace(/_/g, ' ')
                return (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-white font-medium capitalize">{log.action.replace(/_/g, ' ')}</span>
                    {entityName ? (
                      <span className="text-[#a1a1aa]"> — <span className="text-white">{entityName}</span></span>
                    ) : entityLabel && (
                      <span className="text-[#71717a]"> on {entityLabel}</span>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[#3a3a3a] mt-0.5">
                      <span>{(log as any).profiles?.full_name || 'System'}</span>
                      <span>·</span>
                      <span>{formatDateTime(log.created_at)}</span>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-[#71717a]">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
