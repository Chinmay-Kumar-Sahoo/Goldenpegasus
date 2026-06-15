import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import ClientsTable from "@/components/ClientsTable";
export const metadata = { title: "My Marketing Profile | GoldenPegasus" };
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

  const [ownedResult, backupResult, employeeProfiles, allProfilesResult, employeesFromTable] = await Promise.all([
    ownedQuery,
    backupQuery,
    supabase.from('profiles').select('id, full_name, email').neq('role', 'admin').not('role', 'is', null),
    supabase.from('profiles').select('id, full_name, email'),
    supabase.from('employees').select('user_id, full_name, email'),
  ])

  const recordMap = new Map<string, any>()
  for (const r of (ownedResult.data || [])) recordMap.set(r.id, r)
  if (backupResult.error) {
    console.error('Backup query error:', backupResult.error)
  }
  for (const r of (backupResult.data || [])) {
    if (!recordMap.has(r.id)) recordMap.set(r.id, r)
  }
  const rawRecords = Array.from(recordMap.values())

  // Backfill: auto-create missing Candidate_records from marketing_records
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
        const n = (r.name || '').toLowerCase().trim()
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
  }

  // Build employee name lookup map
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
  for (const p of (allProfilesResult?.data || [])) {
    if (!ownerNames[p.id]) {
      const emp = employeeMap.get(p.id)
      ownerNames[p.id] = emp?.full_name || p.full_name || p.email || 'Unknown'
    }
  }

  const records = (rawRecords || []).map(r => ({
    ...r,
    employee_name: ownerNames[r.owner_id] || null,
    backup_employee_name: ((r as any).backup_employee_id ? ownerNames[(r as any).backup_employee_id] : null) || (r as any).backup_employee_name || null,
  }))

  return <ClientsTable isAdmin={false} initialRecords={records} employeeOptions={employeeOptions} initialOwnerNames={ownerNames} currentUserId={uid} />;
}
