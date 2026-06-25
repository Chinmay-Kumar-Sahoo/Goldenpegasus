import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing Records | GoldenPegasus' }

export default async function AllMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const lookupClient = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase

  const { data: rawRecords } = await lookupClient
    .from('marketing_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)

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
      lookupClient.from('profiles').select('id, full_name, email').in('id', ownerIds),
      lookupClient.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
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
  let candidates: any[] = []

  if (candidateNames.length > 0) {
    const nameFilters = candidateNames.map(n => `Candidate_name.ilike.${n}`).join(',')
    const { data: candidatesData } = await lookupClient
      .from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology')
      .or(nameFilters)

    candidates = candidatesData || []

    const allCandidateIds = Array.from(new Set([
      ...candidates.map((c: any) => c.backup_employee_id).filter(Boolean),
      ...candidates.map((c: any) => c.owner_id).filter(Boolean),
    ])) as string[]

    const missingIds = allCandidateIds.filter(id => !ownerNames[id])
    if (missingIds.length > 0) {
      const [{ data: bp }, { data: be }] = await Promise.all([
        lookupClient.from('profiles').select('id, full_name, email').in('id', missingIds),
        lookupClient.from('employees').select('user_id, full_name, email').in('user_id', missingIds),
      ])
      for (const p of (bp || []) as any[]) {
        if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
      }
      for (const e of (be || []) as any[]) {
        if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
      }
    }

    const normalize = (s: string) => s.toLowerCase().trim()
    for (const c of candidates as any[]) {
      const key = normalize(c.Candidate_name) + '|' + normalize(c.technology || '')
      const backupName = c.backup_employee_name || (c.backup_employee_id ? ownerNames[c.backup_employee_id] : null)
      if (backupName) backupNamesByCandidate[key] = backupName
      if (c.owner_id && ownerNames[c.owner_id]) {
        primaryOwnerByCandidate[key] = ownerNames[c.owner_id]
      }
    }
  }

  const normalize = (s: string) => s.toLowerCase().trim()
  const enriched = records.map(r => {
    const lookupKey = normalize((r as any).name || '') + '|' + normalize((r as any).technology || '')
    return {
      ...r,
      employee_name: primaryOwnerByCandidate[lookupKey] || ((r as any).owner_id ? (r as any).employee_name : null) || ownerNames[r.owner_id] || 'Unknown employee',
      backup_employee_name: backupNamesByCandidate[lookupKey] || null,
      technology: (r as any).technology || null,
    }
  })

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
