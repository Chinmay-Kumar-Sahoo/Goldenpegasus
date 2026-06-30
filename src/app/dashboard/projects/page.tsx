import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import ProjectsTable from '@/components/ProjectsTable'

export const metadata = { title: 'My Project Records | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const PROJECT_TABLE_NAME = 'My Project Records'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null

  // Only LOOK UP the table — never auto-create (handled by API via getTableId on first POST)
  const lookupClient = supabaseAdmin || supabase
  const { data: existing } = await (lookupClient.from('dynamic_tables') as any).select('id').eq('table_name', PROJECT_TABLE_NAME).maybeSingle()
  const tableId = existing?.id ?? null

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
