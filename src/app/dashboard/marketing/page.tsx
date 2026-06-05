import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing | GoldenPegasus' }

export default async function AllMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rawRecords } = await supabase
    .from('marketing_records')
    .select('*')
    .order('created_at', { ascending: false })

  if (!rawRecords) {
    return <MarketingTable isAdmin={false} readOnly={true} currentUserId={user?.id ?? null} />
  }

  const records = rawRecords.map(r => ({ ...r, status: (r as any).status || 'Telephone Call' }))

  if (records.length === 0) {
    return <MarketingTable isAdmin={false} readOnly={true} currentUserId={user?.id ?? null} />
  }

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

  // Resolve backup + primary employee names from Candidate_records
  const candidateNames = records.map(r => r.name).filter(Boolean) as string[]
  let backupNamesByCandidate: Record<string, string> = {}
  let primaryOwnerByCandidate: Record<string, string> = {}

  if (candidateNames.length > 0) {
    const { data: candidates } = await supabase
      .from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name')
      .in('Candidate_name', candidateNames)

    const allCandidateIds = Array.from(new Set([
      ...(candidates || []).map((c: any) => c.backup_employee_id).filter(Boolean),
      ...(candidates || []).map((c: any) => c.owner_id).filter(Boolean),
    ])) as string[]

    const missingIds = allCandidateIds.filter(id => !ownerNames[id])
    if (missingIds.length > 0) {
      const [{ data: bp }, { data: be }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('id', missingIds),
        supabase.from('employees').select('user_id, full_name, email').in('user_id', missingIds),
      ])
      for (const p of (bp || []) as any[]) {
        if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
      }
      for (const e of (be || []) as any[]) {
        if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
      }
    }

    for (const c of (candidates || []) as any[]) {
      const name = c.backup_employee_name || (c.backup_employee_id ? ownerNames[c.backup_employee_id] : null)
      if (name) backupNamesByCandidate[c.Candidate_name] = name
      if (c.owner_id && ownerNames[c.owner_id]) {
        primaryOwnerByCandidate[c.Candidate_name] = ownerNames[c.owner_id]
      }
    }
  }

  const enriched = records.map(r => ({
    ...r,
    employee_name: primaryOwnerByCandidate[r.name] || (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
    backup_employee_name: backupNamesByCandidate[r.name] || null,
  }))

  return (
    <MarketingTable
      isAdmin={false}
      readOnly={true}
      currentUserId={user?.id ?? null}
      initialRecords={enriched}
      initialOwnerNames={ownerNames}
    />
  )
}
