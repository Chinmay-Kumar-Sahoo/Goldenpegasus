import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'My Marketing Records | GoldenPegasus' }

export default async function MyMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null
  const lookupClient = supabaseAdmin || supabase

  // Fetch employee options for the component
  const [empProfilesResult, empFromTableResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').neq('role', 'admin').not('role', 'is', null),
    supabase.from('employees').select('user_id, full_name, email'),
  ])

  const empMap = new Map(((empFromTableResult?.data || []) as any[]).map((e: any) => [e.user_id, e]))
  const profileIds = new Set((empProfilesResult.data || []).map((p: any) => p.id))
  const employeeOptions = (empProfilesResult.data || []).map((p: any) => {
    const emp = empMap.get(p.id)
    return { id: p.id, full_name: emp?.full_name || p.full_name || p.email || 'Unknown' }
  })
  for (const e of ((empFromTableResult?.data || []) as any[])) {
    if (e.user_id && !profileIds.has(e.user_id)) {
      employeeOptions.push({ id: e.user_id, full_name: e.full_name || e.email || 'Unknown' })
    }
  }

  const candidateQuery = supabaseAdmin
    ? supabaseAdmin.from('Candidate_records').select('id, Candidate_name, owner_id, status, technology, linkedin_url, backup_employee_id, backup_employee_name').or(`owner_id.eq.${uid},backup_employee_id.eq.${uid}`)
    : supabase.from('Candidate_records').select('id, Candidate_name, owner_id, status, technology, linkedin_url, backup_employee_id, backup_employee_name').or(`owner_id.eq.${uid},backup_employee_id.eq.${uid}`)
  let { data: candidates } = await candidateQuery

  const ownedCandidateNames = (candidates || []).filter(c => c.owner_id === uid).map(c => c.Candidate_name)
  const backupCandidateNames = (candidates || []).filter(c => c.backup_employee_id === uid).map(c => c.Candidate_name)

  // Resolve current user's full name for backup_employee_name fallback
  const currentUserProfile = (empProfilesResult?.data || []).find((p: any) => p.id === uid)
  const currentUserEmployee = (empFromTableResult?.data || []).find((e: any) => e.user_id === uid)
  const currentUserFullName = currentUserProfile?.full_name || currentUserEmployee?.full_name || null

  const [{ data: ownedRecords }, { data: backupRecords }, { data: nameBackupRecords }] = await Promise.all([
    supabase.from('marketing_records').select('*').eq('owner_id', uid).order('created_at', { ascending: false }).limit(2000),
    backupCandidateNames.length > 0
      ? lookupClient.from('marketing_records').select('*').in('name', backupCandidateNames).order('created_at', { ascending: false }).limit(2000)
      : Promise.resolve({ data: [] }),
    currentUserFullName
      ? lookupClient.from('marketing_records').select('*').ilike('backup_employee_name', currentUserFullName).neq('owner_id', uid).order('created_at', { ascending: false }).limit(2000)
      : Promise.resolve({ data: [] }),
  ])

  const recordMap = new Map<string, any>()
  for (const r of (ownedRecords || [])) recordMap.set(r.id, { ...r, is_backup_record: false })
  for (const r of (backupRecords || [])) {
    if (!recordMap.has(r.id)) recordMap.set(r.id, { ...r, is_backup_record: r.owner_id !== uid })
  }
  for (const r of (nameBackupRecords || [])) {
    if (!recordMap.has(r.id)) recordMap.set(r.id, { ...r, is_backup_record: r.owner_id !== uid })
  }
  const mergedRecords = Array.from(recordMap.values())

  // Backfill: auto-create missing Candidate_records for marketing records without matching candidates
  if (supabaseAdmin && mergedRecords.length > 0) {
    const candidateNameSet = new Set((candidates || []).map(c => (c as any).Candidate_name?.toLowerCase().trim()).filter(Boolean))
    const seen = new Set<string>()
    const payloads: any[] = []
    const now = new Date().toISOString()
    for (const r of mergedRecords) {
      const n = (r.name || '').toLowerCase().trim()
      if (!n || candidateNameSet.has(n) || seen.has(n)) continue
      seen.add(n)
      const backupName = (r as any).backup_employee_name
      let backupId: string | null = null
      if (backupName) {
        const eOpt = employeeOptions.find((e: any) => e.full_name?.toLowerCase().trim() === backupName.toLowerCase().trim())
        if (eOpt) backupId = eOpt.id
      }
      payloads.push({
        Candidate_name: r.name,
        technology: r.technology || null,
        owner_id: r.owner_id || uid,
        status: 'Active',
        backup_employee_id: backupId,
        backup_employee_name: backupName || null,
        updated_at: now,
      })
    }
    if (payloads.length > 0) {
      const { data: created, error: insertErr } = await supabaseAdmin.from('Candidate_records').insert(payloads).select()
      if (insertErr) {
        // Try individual inserts as fallback
        for (const p of payloads) {
          const { data: single } = await supabaseAdmin.from('Candidate_records').insert(p).select()
          if (single) candidates = [...(candidates || []), ...(single as any[])]
        }
      } else if (created) {
        candidates = [...(candidates || []), ...(created as any[])]
      }
    }
  }

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

  // Also ensure employeeOptions entries are in ownerNames
  for (const opt of employeeOptions) {
    if (!ownerNames[opt.id]) ownerNames[opt.id] = opt.full_name
  }

  // Resolve backup employee names from candidates
  const candidateBackupIds = Array.from(new Set((candidates || []).map((c: any) => c.backup_employee_id).filter(Boolean))) as string[]
  const candidateOwnerIds = Array.from(new Set((candidates || []).map((c: any) => c.owner_id).filter(Boolean))) as string[]
  const allCandidateIds = Array.from(new Set([...candidateBackupIds, ...candidateOwnerIds]))
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

  const normalize = (s: string) => s.toLowerCase().trim()
  const backupNamesByCandidate: Record<string, string> = {}
  const primaryOwnerByCandidate: Record<string, string> = {}
  for (const c of (candidates || []) as any[]) {
    const key = normalize((c as any).Candidate_name) + '|' + normalize((c as any).technology || '')
    const backupName = (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null)
    if (backupName) backupNamesByCandidate[key] = backupName
    if ((c as any).owner_id && ownerNames[(c as any).owner_id]) {
      primaryOwnerByCandidate[key] = ownerNames[(c as any).owner_id]
    }
  }

  // Filter out records whose candidate status is Closed
  const closedCandidateNames = new Set((candidates || []).filter((c: any) => c.status === 'Closed').map((c: any) => c.Candidate_name))
  const activeMergedRecords = mergedRecords.filter(r => !closedCandidateNames.has(r.name))

  const enrichedRecords = activeMergedRecords.map(r => {
    const lookupKey = normalize((r as any).name || '') + '|' + normalize((r as any).technology || '')
    return {
      ...r,
      status: (r as any).status || 'Telephone Call',
      employee_name: primaryOwnerByCandidate[lookupKey] || (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
      backup_employee_name: backupNamesByCandidate[lookupKey] || null,
      technology: (r as any).technology || null,
    }
  })

  const candidateOptions = (candidates || [])
    .filter((c: any) => c.status !== 'Closed')
    .map((c: any) => ({
    id: c.id,
    name: c.Candidate_name,
    owner_id: c.owner_id,
    status: c.status,
    technology: (c as any).technology || null,
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
      employeeOptions={employeeOptions}
      candidateOptions={candidateOptions}
    />
  )
}
