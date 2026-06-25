import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import ClientsTable from "@/components/ClientsTable";
export const metadata = { title: "My Candidate Profile | GoldenPegasus" };
export default async function EmployeeClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null

  const ownedQuery = supabase.from('Candidate_records').select('*').eq('owner_id', uid).order('created_at', { ascending: false })
  const backupQuery = supabaseAdmin
    ? supabaseAdmin.from('Candidate_records').select('*').eq('backup_employee_id', uid).order('created_at', { ascending: false })
    : supabase.from('Candidate_records').select('*').eq('backup_employee_id', uid).order('created_at', { ascending: false })

  const [ownedResult, backupResult, employeeProfiles, allProfilesResult, employeesFromTable, adminProfiles] = await Promise.all([
    ownedQuery,
    backupQuery,
    supabase.from('profiles').select('id, full_name, email').neq('role', 'admin').not('role', 'is', null),
    supabase.from('profiles').select('id, full_name, email'),
    supabase.from('employees').select('user_id, full_name, email'),
    supabase.from('profiles').select('id').eq('role', 'admin'),
  ])

  const adminIds = new Set((adminProfiles?.data || []).map((p: any) => p.id))

  const recordMap = new Map<string, any>()
  for (const r of (ownedResult.data || [])) recordMap.set(r.id, r)
  if (backupResult.error) {
    console.error('Backup query error:', backupResult.error)
  }
  for (const r of (backupResult.data || [])) {
    if (!recordMap.has(r.id)) recordMap.set(r.id, r)
  }
  const rawRecords = Array.from(recordMap.values())

  // Deduplicate by (Candidate_name, technology) — keep original (oldest) record per unique combination
  {
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

  // Resolve current user's full name for backup_employee_name matching
  let currentUserFullName: string | null = null
  if (uid) {
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle(),
      supabase.from('employees').select('full_name').eq('user_id', uid).maybeSingle(),
    ])
    currentUserFullName = p?.full_name || e?.full_name || null
  }

  // Backfill: auto-create missing Candidate_records from marketing_records
  const normalizeKey = (s: string) => s.toLowerCase().trim()
  if (supabaseAdmin && uid) {
    const existingNames = new Set(rawRecords.map(r => (r as any).Candidate_name?.toLowerCase().trim()).filter(Boolean))
    const { data: mktRecords } = await supabaseAdmin
      .from('marketing_records')
      .select('name, technology, owner_id, backup_employee_name')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false })
      .limit(200)
    if (mktRecords) {
      const seen = new Set<string>()
      const payloads: any[] = []
      const now = new Date().toISOString()
      for (const r of mktRecords as any[]) {
        const n = normalizeKey(r.name || '')
        if (!n || existingNames.has(n) || seen.has(n)) continue
        seen.add(n)
        const backupName = r.backup_employee_name || null
        payloads.push({ Candidate_name: r.name, technology: r.technology || null, owner_id: r.owner_id || uid, status: 'Active', backup_employee_name: backupName, updated_at: now })
      }
      if (payloads.length > 0) {
        const { data: created } = await supabaseAdmin.from('Candidate_records').insert(payloads).select()
        if (created) rawRecords.push(...(created as any[]))
      }
    }

    // Also backfill from marketing_records where user is the backup employee
    if (currentUserFullName) {
      const existingByKey = new Map<string, any>()
      for (const r of rawRecords) {
        const key = normalizeKey((r as any).Candidate_name || '') + '|' + normalizeKey((r as any).technology || '')
        if (key) existingByKey.set(key, r)
      }
      const { data: backupMktRecords } = await supabaseAdmin
        .from('marketing_records')
        .select('name, technology, owner_id, backup_employee_name')
        .ilike('backup_employee_name', currentUserFullName)
        .neq('owner_id', uid)
        .order('created_at', { ascending: false })
        .limit(200)
      if (backupMktRecords) {
        const seen = new Set<string>()
        const inserts: any[] = []
        const updates: { id: string; data: any }[] = []
        const now = new Date().toISOString()
        for (const r of backupMktRecords as any[]) {
          const key = normalizeKey((r.name || '') + '|' + normalizeKey(r.technology || ''))
          if (!key || seen.has(key)) continue
          seen.add(key)
          const existing = existingByKey.get(key)
          if (existing) {
            if (!existing.backup_employee_id || existing.backup_employee_id !== uid) {
              updates.push({ id: existing.id, data: { backup_employee_id: uid, backup_employee_name: currentUserFullName, updated_at: now } })
            }
          } else {
            inserts.push({ Candidate_name: r.name, technology: r.technology || null, owner_id: r.owner_id || uid, status: 'Active', backup_employee_id: uid, backup_employee_name: currentUserFullName, updated_at: now })
          }
        }
        if (updates.length > 0) {
          for (const u of updates) {
            await supabaseAdmin.from('Candidate_records').update(u.data).eq('id', u.id)
            const found = rawRecords.find(r => r.id === u.id)
            if (found) {
              Object.assign(found, u.data)
            } else {
              const { data: fetched } = await supabaseAdmin.from('Candidate_records').select('*').eq('id', u.id).single()
              if (fetched) rawRecords.push(fetched as any)
            }
          }
        }
        if (inserts.length > 0) {
          const { data: created } = await supabaseAdmin.from('Candidate_records').insert(inserts).select()
          if (created) rawRecords.push(...(created as any[]))
        }
      }
    }
  }

  // Build employee name lookup map
  const employeeMap = new Map(((employeesFromTable?.data || []) as any[]).map((e: any) => [e.user_id, e]))
  const employeeOptions = (employeeProfiles.data || []).map((p: any) => {
    const emp = employeeMap.get(p.id)
    return { id: p.id, full_name: emp?.full_name || p.full_name || p.email || 'Unknown' }
  })
  const profileIds = new Set((employeeProfiles.data || []).map((p: any) => p.id))
  for (const e of ((employeesFromTable?.data || []) as any[])) {
    if (e.user_id && !profileIds.has(e.user_id) && !adminIds.has(e.user_id)) {
      employeeOptions.push({ id: e.user_id, full_name: e.full_name || e.email || 'Unknown' })
    }
  }

  const ownerNames: Record<string, string> = {}
  for (const opt of employeeOptions) {
    ownerNames[opt.id] = opt.full_name
  }
  for (const p of (allProfilesResult?.data || [])) {
    if (!ownerNames[p.id]) {
      const emp = employeeMap.get(p.id)
      ownerNames[p.id] = emp?.full_name || p.full_name || p.email || 'Unknown'
    }
  }

  const records = (rawRecords || []).map(r => ({
    ...r,
    employee_name: ownerNames[r.owner_id] || null,
    backup_employee_name: (r as any).backup_employee_id ? ((r as any).backup_employee_name || ownerNames[(r as any).backup_employee_id] || null) : null,
  }))

  return <ClientsTable isAdmin={false} initialRecords={records} employeeOptions={employeeOptions} initialOwnerNames={ownerNames} currentUserId={uid} />;
}
