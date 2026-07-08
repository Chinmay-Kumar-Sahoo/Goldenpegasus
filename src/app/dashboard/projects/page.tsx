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

  const lookupClient = supabaseAdmin || supabase
  const { data: existing } = await (lookupClient.from('dynamic_tables') as any).select('id').eq('table_name', PROJECT_TABLE_NAME).maybeSingle()
  const tableId = existing?.id ?? null

  const fetchClient = supabaseAdmin || supabase
  let records: any[] = []
  if (tableId) {
    const { data } = await fetchClient.from('dynamic_table_records').select('*').eq('table_id', tableId).eq('owner_id', uid).order('created_at', { ascending: false }).limit(2000)
    records = data || []
  }

  return (
    <ProjectsTable
      currentUserId={uid}
      tableId={tableId}
      initialRecords={records}
    />
  )
}
