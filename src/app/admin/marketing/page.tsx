import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing Records | Admin | GoldenPegasus' }

export default async function AdminMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const lookupClient = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase

  const [recordsResult, employeeProfiles, employeesFromTable, candidatesResult] = await Promise.all([
    supabase.from('marketing_records').select('*').order('created_at', { ascending: false }).limit(2000),
    lookupClient.from('profiles').select('id, full_name, email').neq('role', 'admin').not('role', 'is', null),
    lookupClient.from('employees').select('user_id, full_name, email'),
    lookupClient.from('Candidate_records').select('id, Candidate_name, owner_id, status, technology, linkedin_url, backup_employee_id, backup_employee_name'),
  ])

  const records = (recordsResult.data || []).map(r => ({ ...r, status: (r as any).status || 'Telephone Call' }))

  if (!records || records.length === 0) {
    return <MarketingTable isAdmin={true} readOnly={false} currentUserId={user?.id ?? null} />
  }

  const ownerIds = Array.from(new Set(records.map(r => r.owner_id).filter(Boolean)))
  let ownerNames: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      lookupClient.from('profiles').select('id, full_name, email').in('id', ownerIds),
      lookupClient.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
    ])
    ownerNames = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || p.email || 'Unknown employee']))
    for (const e of (employees || [])) {
      if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
    }
  }

  const employeeMap = new Map(((employeesFromTable?.data || []) as any[]).map((e: any) => [e.user_id, e]))
  const profileIds = new Set((employeeProfiles.data || []).map((p: any) => p.id))

  const employeeOptions = (employeeProfiles.data || []).map((p: any) => {
    const emp = employeeMap.get(p.id)
    return { id: p.id, full_name: emp?.full_name || p.full_name || p.email || 'Unknown' }
  })

  for (const e of ((employeesFromTable?.data || []) as any[])) {
    if (e.user_id && !profileIds.has(e.user_id)) {
      employeeOptions.push({ id: e.user_id, full_name: e.full_name || e.email || 'Unknown' })
    }
  }

  for (const opt of employeeOptions) {
    if (!ownerNames[opt.id]) ownerNames[opt.id] = opt.full_name
  }

  const candidateOptions = (candidatesResult.data || [])
    .filter((c: any) => c.status !== 'Closed')
    .map((c: any) => ({
    id: c.id,
    name: c.Candidate_name,
    owner_id: c.owner_id,
    owner_name: ownerNames[c.owner_id] || null,
    status: c.status,
    technology: (c as any).technology || null,
    backup_employee_id: (c as any).backup_employee_id,
    backup_employee_name: (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null) || null,
  }))

  // Build enrichment maps keyed by normalized name|technology
  const backupNamesByCandidate: Record<string, string> = {}
  const primaryOwnerByCandidate: Record<string, string> = {}
  const normalize = (s: string) => s.toLowerCase().trim()
  for (const c of (candidatesResult.data || []) as any[]) {
    const key = normalize((c as any).Candidate_name) + '|' + normalize((c as any).technology || '')
    const backupName = (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null)
    if (backupName) backupNamesByCandidate[key] = backupName
    if ((c as any).owner_id && ownerNames[(c as any).owner_id]) {
      primaryOwnerByCandidate[key] = ownerNames[(c as any).owner_id]
    }
  }

  // Filter out records whose candidate status is Closed
  const closedCandidateNames = new Set((candidatesResult.data || []).filter((c: any) => c.status === 'Closed').map((c: any) => c.Candidate_name))
  const activeRecords = records.filter(r => !closedCandidateNames.has(r.name))

  const enrichedRecords = activeRecords.map(r => {
    const lookupKey = normalize((r as any).name || '') + '|' + normalize((r as any).technology || '')
    return {
      ...r,
      employee_name: primaryOwnerByCandidate[lookupKey] || (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
      backup_employee_name: backupNamesByCandidate[lookupKey] || null,
      technology: (r as any).technology || null,
    }
  })

  return (
    <MarketingTable
      isAdmin={true}
      readOnly={false}
      currentUserId={user?.id ?? null}
      initialRecords={enrichedRecords}
      initialOwnerNames={ownerNames}
      employeeOptions={employeeOptions}
      candidateOptions={candidateOptions}
    />
  )
}
