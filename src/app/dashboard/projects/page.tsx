import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import ProjectsTable from '@/components/ProjectsTable'

export const metadata = { title: 'My Project Records | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const PROJECT_TABLE_NAME = 'My Project Records'
const PROJECT_SCHEMA = [
  { name: 'candidate_name', label: 'Candidate Name', type: 'text', required: true },
  { name: 'technology', label: 'Technology', type: 'text', required: false },
  { name: 'created_date', label: 'Created Date', type: 'date', required: false },
  { name: 'company_name', label: 'Company Name', type: 'text', required: false },
  { name: 'project_status', label: 'Project Status', type: 'text', required: false },
  { name: 'project_type', label: 'Project Type', type: 'text', required: false },
  { name: 'project_rate', label: 'Project Rate', type: 'text', required: false },
  { name: 'project_start_date', label: 'Project Start Date', type: 'date', required: false },
  { name: 'project_end_date', label: 'Project End Date', type: 'date', required: false },
] as const

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null

  // Try to find or create the project table entry — use admin client first (avoids RLS / table_id mismatch)
  const lookupClient = supabaseAdmin || supabase
  let tableId: string | null | undefined

  const { data: existing } = await (lookupClient.from('dynamic_tables') as any).select('id').eq('table_name', PROJECT_TABLE_NAME).maybeSingle()
  tableId = existing?.id

  if (!tableId) {
    const { data: inserted } = await (lookupClient.from('dynamic_tables') as any).insert({
      table_name: PROJECT_TABLE_NAME,
      description: 'Employee project records',
      schema_definition: PROJECT_SCHEMA,
      is_global: false,
      owner_id: uid,
    }).select('id').single()
    tableId = inserted?.id
  }

  // Ensure the user can access it
  if (tableId && supabaseAdmin) {
    await (supabaseAdmin.from('dynamic_tables') as any).update({ owner_id: uid }).eq('id', tableId)
  }

  // Fetch project records — use admin client when available to avoid RLS issues
  const fetchClient = supabaseAdmin || supabase
  let records: any[] = []
  if (tableId) {
    const { data } = await fetchClient.from('dynamic_table_records').select('*').eq('table_id', tableId).eq('owner_id', uid).order('created_at', { ascending: false }).limit(2000)
    records = data || []
  }

  // Fetch candidate options for this user (from Candidate_records where owner or backup)
  let candidateOptions: Array<{ name: string; technology: string | null }> = []
  if (uid) {
    const [{ data: asOwner }, { data: asBackup }] = await Promise.all([
      lookupClient.from('Candidate_records').select('Candidate_name, technology').eq('owner_id', uid),
      lookupClient.from('Candidate_records').select('Candidate_name, technology').eq('backup_employee_id', uid),
    ])
    const all = [...(asOwner || []), ...(asBackup || [])]
    const seen = new Set<string>()
    for (const c of all) {
      const key = ((c.Candidate_name || '') + '|' + (c.technology || '')).toLowerCase().trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      candidateOptions.push({ name: c.Candidate_name, technology: c.technology })
    }
  }

  return (
    <ProjectsTable
      currentUserId={uid}
      tableId={tableId}
      initialRecords={records}
      candidateOptions={candidateOptions}
    />
  )
}
