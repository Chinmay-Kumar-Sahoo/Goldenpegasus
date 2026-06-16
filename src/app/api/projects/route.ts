import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

let _adminClient: ReturnType<typeof createAdminClient> | null = null
function getAdminClient() {
  if (_adminClient) return _adminClient
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (key) _adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _adminClient
}

async function ensureProjectTable(supabase: any): Promise<string | null> {
  const adminClient = getAdminClient()
  const client = adminClient || supabase
  const { data: existing } = await client.from('dynamic_tables').select('id').eq('table_name', PROJECT_TABLE_NAME).maybeSingle()
  if (existing) return existing.id
  if (!adminClient) return null
  const { data: inserted, error } = await (adminClient.from('dynamic_tables') as any).insert({
    table_name: PROJECT_TABLE_NAME,
    description: 'Employee project records',
    schema_definition: PROJECT_SCHEMA,
    is_global: false,
  }).select('id').single() as any
  if (error || !inserted) return null
  return inserted.id
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tableId = searchParams.get('table_id') || await ensureProjectTable(supabase)
  if (!tableId) return NextResponse.json({ error: 'Server error: cannot find or create project table' }, { status: 500 })

  const ownerFilter = searchParams.get('owner_id')
  const limitParam = Math.min(Number(searchParams.get('limit')) || 2000, 2000)

  const adminClient = getAdminClient()
  const lookupClient = adminClient || supabase

  let query = lookupClient.from('dynamic_table_records').select('*').eq('table_id', tableId).order('created_at', { ascending: false }).limit(limitParam)
  if (ownerFilter) query = query.eq('owner_id', ownerFilter)
  const { data: records, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ownerIds = Array.from(new Set((records || []).map((r: any) => r.owner_id).filter(Boolean)))
  const ownerNames: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      lookupClient.from('profiles').select('id, full_name, email').in('id', ownerIds),
      lookupClient.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
    ])
    for (const p of (profiles || [])) if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown'
    for (const e of (employees || [])) if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown'
  }

  const enriched = (records || []).map((r: any) => ({
    ...r,
    employee_name: ownerNames[r.owner_id] || null,
  }))

  return NextResponse.json({ records: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, data: recordData } = body
  const tableId = body.table_id || await ensureProjectTable(supabase)
  if (!tableId) return NextResponse.json({ error: 'Server error: cannot find or create project table' }, { status: 500 })

  if (id) {
    const { error: updateErr } = await supabase.from('dynamic_table_records').update({ data: recordData, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { data: inserted, error } = await supabase.from('dynamic_table_records').insert({
    table_id: tableId,
    owner_id: user.id,
    data: recordData,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: inserted?.id })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('dynamic_table_records').delete().eq('id', id).eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
