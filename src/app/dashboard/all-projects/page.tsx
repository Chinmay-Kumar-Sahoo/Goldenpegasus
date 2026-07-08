import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import ProjectsTable from '@/components/ProjectsTable'

export const metadata = { title: 'All Project Records | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const PROJECT_TABLE_NAME = 'My Project Records'

export default async function AllProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const lookupClient = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase

  const { data: table } = await (lookupClient.from('dynamic_tables') as any).select('id').eq('table_name', PROJECT_TABLE_NAME).maybeSingle()
  const tableId = table?.id ?? null

  let records: any[] = []
  if (tableId) {
    const { data } = await lookupClient.from('dynamic_table_records').select('*').eq('table_id', tableId).order('created_at', { ascending: false }).limit(2000)
    records = data || []
  }

  const ownerIds = Array.from(new Set(records.map((r: any) => r.owner_id).filter(Boolean))) as string[]
  const ownerNames: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      lookupClient.from('profiles').select('id, full_name, email').in('id', ownerIds),
      lookupClient.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
    ])
    for (const p of (profiles || [])) if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown'
    for (const e of (employees || [])) if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown'
  }

  const enriched = records.map((r: any) => ({
    ...r,
    employee_name: ownerNames[r.owner_id] || null,
  }))

  return (
    <ProjectsTable
      currentUserId={user?.id ?? null}
      tableId={tableId}
      initialRecords={enriched}
      readOnly={true}
      title="All Project Records"
    />
  )
}
