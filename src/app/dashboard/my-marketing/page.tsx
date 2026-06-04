import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'My Marketing Records | GoldenPegasus' }

export default async function MyMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const { data: candidates } = await supabase
    .from('Candidate_records')
    .select('id, Candidate_name, owner_id, status, backup_employee_id')
    .or(`owner_id.eq.${uid},backup_employee_id.eq.${uid}`)

  const ownedCandidateNames = (candidates || []).filter(c => c.owner_id === uid).map(c => c.Candidate_name)
  const backupCandidateNames = (candidates || []).filter(c => c.backup_employee_id === uid).map(c => c.Candidate_name)

  const [{ data: ownedRecords }, { data: backupRecords }] = await Promise.all([
    supabase.from('marketing_records').select('*').eq('owner_id', uid).order('created_at', { ascending: false }),
    backupCandidateNames.length > 0
      ? supabase.from('marketing_records').select('*').in('name', backupCandidateNames).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const recordMap = new Map<string, any>()
  for (const r of (ownedRecords || [])) recordMap.set(r.id, { ...r, is_backup_record: false })
  for (const r of (backupRecords || [])) {
    if (!recordMap.has(r.id)) recordMap.set(r.id, { ...r, is_backup_record: r.owner_id !== uid })
  }
  const mergedRecords = Array.from(recordMap.values())

  // Build owner names from all records
  const ownerIds = Array.from(new Set(mergedRecords.map(r => r.owner_id).filter(Boolean)))
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

  // Resolve backup employee names from candidates
  const backupNamesByCandidate: Record<string, string> = {}
  for (const c of (candidates || []) as any[]) {
    const name = (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null)
    if (name) backupNamesByCandidate[(c as any).Candidate_name] = name
  }

  const enrichedRecords = mergedRecords.map(r => ({
    ...r,
    status: (r as any).status || 'Telephone Call',
    employee_name: (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
    backup_employee_name: backupNamesByCandidate[r.name] || null,
  }))

  const candidateOptions = (candidates || []).map((c: any) => ({
    id: c.id,
    name: c.Candidate_name,
    owner_id: c.owner_id,
    status: c.status,
    backup_employee_id: c.backup_employee_id,
    backup_employee_name: (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null) || null,
  }))

  return (
    <MarketingTable
      isAdmin={false}
      readOnly={false}
      currentUserId={uid}
      initialRecords={enrichedRecords}
      initialOwnerNames={ownerNames}
      candidateOptions={candidateOptions}
    />
  )
}
