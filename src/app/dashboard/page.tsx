import { createClient as createAdminClient } from '@supabase/supabase-js'
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

  const uid = user.id

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null
  const lookupClient = supabaseAdmin || supabase

  const [{ count: mktCount }, { count: tableCount }, { data: _profileData }, { data: projectTable }] = await Promise.all([
    supabase.from('marketing_records').select('*', { count: 'exact', head: true }).eq('owner_id', uid),
    supabase.from('dynamic_tables').select('*', { count: 'exact', head: true }).eq('owner_id', uid),
    supabase.from('profiles').select('full_name, email').eq('id', uid).single(),
    lookupClient.from('dynamic_tables').select('id').eq('table_name', 'My Project Records').maybeSingle(),
  ])
  let projectCount = 0
  if (projectTable?.id) {
    const { count } = await lookupClient.from('dynamic_table_records').select('*', { count: 'exact', head: true }).eq('table_id', projectTable.id).eq('owner_id', uid)
    projectCount = count ?? 0
  }

  // Count Candidate_records where user is owner OR backup (matches My Marketing Profile), excluding Closed
  const { data: clientCandidates, count: clientCount } = await lookupClient
    .from('Candidate_records')
    .select('*', { count: 'exact', head: false })
    .or(`owner_id.eq.${uid},backup_employee_id.eq.${uid}`)
    .neq('status', 'Closed')
  const clientDedup = new Set((clientCandidates || []).map((c: any) => ((c.Candidate_name || '') + '|' + (c.technology || '')).toLowerCase().trim()).filter(Boolean))
  const clientDedupCount = clientDedup.size

  // Count backup marketing records: records where employee is assigned as backup for a specific candidate+technology
  const normalizeKey = (s: string) => s.toLowerCase().trim()
  const backupIds = new Set<string>()

  // Build backup name|technology key set from Candidate_records
  const { data: backupCandidates } = await lookupClient
    .from('Candidate_records')
    .select('Candidate_name, technology')
    .eq('backup_employee_id', uid)

  if (backupCandidates && backupCandidates.length > 0) {
    const backupKeys = new Set<string>()
    for (const c of backupCandidates) {
      backupKeys.add(normalizeKey(c.Candidate_name) + '|' + normalizeKey(c.technology || ''))
    }

    const names = [...new Set(backupCandidates.map(c => c.Candidate_name))]

    // 1) Match by Candidate_records → candidate name → marketing_records name
    const { data: byName } = await lookupClient
      .from('marketing_records')
      .select('id, name, technology, owner_id')
      .in('name', names)
      .neq('owner_id', uid)
    if (byName) {
      for (const r of byName) {
        const key = normalizeKey(r.name) + '|' + normalizeKey(r.technology || '')
        if (backupKeys.has(key)) backupIds.add(r.id)
      }
    }

    // 2) Fallback: match by backup_employee_name (handles case-mismatched names)
    const myName = _profileData?.full_name
    if (myName) {
      const { data: byBackupName } = await lookupClient
        .from('marketing_records')
        .select('id, name, technology, owner_id')
        .ilike('backup_employee_name', myName)
        .neq('owner_id', uid)
      if (byBackupName) {
        for (const r of byBackupName) {
          const key = normalizeKey(r.name) + '|' + normalizeKey(r.technology || '')
          if (backupKeys.has(key)) backupIds.add(r.id)
        }
      }
    }
  }

  const totalMktCount = (mktCount ?? 0) + backupIds.size

  const stats = [
    { label: 'My Marketing Records', value: totalMktCount, icon: '📈', href: '/dashboard/my-marketing' },
    { label: 'My Client Records', value: clientDedupCount, icon: '🤝', href: '/dashboard/clients' },
    { label: 'My Project Records', value: projectCount, icon: '📋', href: '/dashboard/projects' },
    { label: 'My Custom Tables', value: tableCount ?? 0, icon: '🏗️', href: '/dashboard/tables' },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard Overview"
        subtitle="Your personal data dashboard"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
            { label: 'Add Project Record', href: '/dashboard/projects?action=new', icon: '📋' },
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
