import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import Link from 'next/link'
import { formatDateTime } from '@/lib/format'

export const metadata = { title: 'Admin Dashboard | GoldenPegasus' }

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ count: employeeCount }, { count: adminCount }, { count: mktCount }, { count: clientCount }, { count: tableCount }, { data: recentLogs }] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employee'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('marketing_records').select('*', { count: 'exact', head: true }),
      supabase.from('Candidate_records').select('*', { count: 'exact', head: true }),
      supabase.from('dynamic_tables').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('action, entity_type, created_at').order('created_at', { ascending: false }).limit(5),
    ])

  const stats = [
    { label: 'Employees', value: employeeCount ?? 0, icon: '👥', href: '/admin/employees' },
    { label: 'Admins', value: adminCount ?? 0, icon: '🔑', href: '/admin/admins', color: 'blue' },
    { label: 'Marketing Records', value: mktCount ?? 0, icon: '📈', href: '/admin/marketing', color: 'green' },
    { label: 'Client Records', value: clientCount ?? 0, icon: '🤝', href: '/admin/clients', color: 'purple' },
    { label: 'Dynamic Tables', value: tableCount ?? 0, icon: '🏗️', href: '/admin/tables', color: 'yellow' },
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
              { label: 'View Audit Logs', href: '/admin/audit', icon: '📋' },
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
              {recentLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-white font-medium">{log.action}</span>
                    {log.entity_type && <span className="text-[#71717a]"> on {log.entity_type}</span>}
                    <div className="text-xs text-[#3a3a3a] mt-0.5">
                      {formatDateTime(log.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#71717a]">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
