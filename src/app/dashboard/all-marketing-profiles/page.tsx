import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import ClientsTable from '@/components/ClientsTable'

export const metadata = { title: 'All Marketing Profiles | GoldenPegasus' }

export default async function AllMarketingProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const lookupClient = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase

  const [recordsResult, employeeProfiles, allProfiles, employeesFromTable] = await Promise.all([
    lookupClient.from('Candidate_records').select('*').order('created_at', { ascending: false }).limit(2000),
    lookupClient.from('profiles').select('id, full_name, email').neq('role', 'admin').not('role', 'is', null),
    lookupClient.from('profiles').select('id, full_name, email'),
    lookupClient.from('employees').select('user_id, full_name, email'),
  ])

  const rawRecords = recordsResult.data

  // Deduplicate by (Candidate_name, technology) — keep original (oldest) record per unique combination
  if (rawRecords) {
    const dedupMap = new Map<string, any>()
    for (const r of rawRecords) {
      const key = ((r.Candidate_name || '') + '|' + (r.technology || '')).toLowerCase().trim()
      if (!key) { dedupMap.set(r.id, r); continue }
      const existing = dedupMap.get(key)
      if (!existing || (r.created_at || '') < (existing.created_at || '')) {
        dedupMap.set(key, r)
      }
    }
    rawRecords.length = 0
    rawRecords.push(...Array.from(dedupMap.values()))
  }

  const employeeMap = new Map(((employeesFromTable?.data || []) as any[]).map((e: any) => [e.user_id, e]))
  const employeeOptions = (employeeProfiles.data || []).map((p: any) => {
    const emp = employeeMap.get(p.id)
    return { id: p.id, full_name: emp?.full_name || p.full_name || p.email || 'Unknown' }
  })
  const profileIds = new Set((employeeProfiles.data || []).map((p: any) => p.id))
  for (const e of ((employeesFromTable?.data || []) as any[])) {
    if (e.user_id && !profileIds.has(e.user_id)) {
      employeeOptions.push({ id: e.user_id, full_name: e.full_name || e.email || 'Unknown' })
    }
  }

  const ownerNames: Record<string, string> = {}
  for (const opt of employeeOptions) {
    ownerNames[opt.id] = opt.full_name
  }
  // Include all profiles (including admins) for name resolution
  for (const p of (allProfiles?.data || [])) {
    if (!ownerNames[p.id]) {
      const emp = employeeMap.get(p.id)
      ownerNames[p.id] = emp?.full_name || p.full_name || p.email || 'Unknown'
    }
  }

  const records = (rawRecords || []).map(r => ({ ...r, employee_name: ownerNames[r.owner_id] || null, backup_employee_name: ((r as any).backup_employee_id ? ownerNames[(r as any).backup_employee_id] : null) || (r as any).backup_employee_name || null }))

  return <ClientsTable isAdmin={false} readOnly={false} initialRecords={records} employeeOptions={employeeOptions} initialOwnerNames={ownerNames} currentUserId={uid} />
}
