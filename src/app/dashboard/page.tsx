import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard | GoldenPegasus' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: mktCount },
    { count: clientCount },
    { count: tableCount },
    { data: _profileData },
  ] = await Promise.all([
    supabase.from('marketing_records').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('Candidate_records').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('dynamic_tables').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
  ])

  const stats = [
    { label: 'My Marketing Records', value: mktCount ?? 0, icon: '📈', href: '/dashboard/my-marketing' },
    { label: 'My Client Records', value: clientCount ?? 0, icon: '🤝', href: '/dashboard/clients' },
    { label: 'My Custom Tables', value: tableCount ?? 0, icon: '🏗️', href: '/dashboard/tables' },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard Overview"
        subtitle="Your personal data dashboard"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-5 hover:border-[#22c55e]/30 hover:bg-[#1a1a1a] transition-all duration-200">
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-[#71717a]">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { label: 'Update Personal Details', href: '/dashboard/profile', icon: '👤' },
            { label: 'View All Marketing Data', href: '/dashboard/marketing', icon: '📊' },
            { label: 'Add Marketing Record', href: '/dashboard/my-marketing?action=new', icon: '➕' },
            { label: 'Add Client Record', href: '/dashboard/clients?action=new', icon: '🤝' },
            { label: 'Create Custom Table', href: '/dashboard/tables?action=new', icon: '🏗️' },
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
    </div>
  )
}
