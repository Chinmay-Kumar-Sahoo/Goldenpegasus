import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing | Admin | GoldenPegasus' }

export default async function AdminMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [recordsResult, employeeProfiles, employeesFromTable, candidatesResult] = await Promise.all([
    supabase.from('marketing_records').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email').neq('role', 'admin').not('role', 'is', null),
    supabase.from('employees').select('user_id, full_name, email'),
    supabase.from('Candidate_records').select('id, Candidate_name, owner_id, status, backup_employee_id'),
  ])

  const records = (recordsResult.data || []).map(r => ({ ...r, status: (r as any).status || 'Telephone Call' }))

  if (!records) {
    return <MarketingTable isAdmin={true} readOnly={false} currentUserId={user?.id ?? null} />
  }

  // Build owner names lookup (same as before)
  const ownerIds = Array.from(new Set(records.map(r => r.owner_id).filter(Boolean)))
  let ownerNames: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
      supabase.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
    ])
    ownerNames = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || p.email || 'Unknown employee']))
    for (const e of (employees || [])) {
      if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
    }
  }

  // Build employee dropdown options
  const employeeMap = new Map(((employeesFromTable?.data || []) as any[]).map((e: any) => [e.user_id, e]))
  const employeeOptions = (employeeProfiles.data || []).map((p: any) => {
    const emp = employeeMap.get(p.id)
    return {
      id: p.id,
      full_name: emp?.full_name || p.full_name || p.email || 'Unknown',
    }
  })
  // Also add employees that only exist in the employees table but not in profiles
  const profileIds = new Set((employeeProfiles.data || []).map((p: any) => p.id))
  for (const e of ((employeesFromTable?.data || []) as any[])) {
    if (e.user_id && !profileIds.has(e.user_id)) {
      employeeOptions.push({ id: e.user_id, full_name: e.full_name || e.email || 'Unknown' })
    }
  }

  // Ensure ownerNames covers all employees for backup resolution
  for (const opt of employeeOptions) {
    if (!ownerNames[opt.id]) ownerNames[opt.id] = opt.full_name
  }

  // Build candidate dropdown options
  const candidateOptions = (candidatesResult.data || []).map((c: any) => ({
    id: c.id,
    name: c.Candidate_name,
    owner_id: c.owner_id,
    owner_name: ownerNames[c.owner_id] || null,
    status: c.status,
    backup_employee_id: (c as any).backup_employee_id,
    backup_employee_name: (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null) || null,
  }))

  // Build backup name lookup from candidates
  const backupNamesByCandidate: Record<string, string> = {}
  for (const c of (candidatesResult.data || []) as any[]) {
    const name = (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null)
    if (name) backupNamesByCandidate[(c as any).Candidate_name] = name
  }

  const enrichedRecords = records.map(r => ({
    ...r,
    employee_name: (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
    backup_employee_name: backupNamesByCandidate[r.name] || null,
  }))

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
