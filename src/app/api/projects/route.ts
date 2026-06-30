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

async function getTableId(supabase: any, _userId: string): Promise<{ id: string | null; error?: string }> {
  const adminClient = getAdminClient()
  if (adminClient) {
    const { data: found } = await (adminClient.from('dynamic_tables') as any).select('id').eq('table_name', PROJECT_TABLE_NAME).maybeSingle()
    if (found?.id) return { id: found.id }
    return { id: null, error: 'Project table is not configured. An admin must create it in Custom Tables.' }
  }

  const { data: existing, error: lookupErr } = await (supabase.from('dynamic_tables') as any).select('id').eq('table_name', PROJECT_TABLE_NAME).maybeSingle()
  if (existing?.id) return { id: existing.id }
  if (lookupErr) return { id: null, error: `Lookup error: ${lookupErr.message}` }
  return { id: null, error: 'Project table is not configured. An admin must create it in Custom Tables.' }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tableId = searchParams.get('table_id')
  let resolvedId = tableId || undefined
  if (!resolvedId) {
    const result = await getTableId(supabase, user.id)
    if (!result.id) return NextResponse.json({ error: result.error || 'Cannot find or create project table' }, { status: 500 })
    resolvedId = result.id
  }

  const ownerFilter = searchParams.get('owner_id')
  const limitParam = Math.min(Number(searchParams.get('limit')) || 2000, 2000)

  const adminClient = getAdminClient()
  const lookupClient = adminClient || supabase

  let query = lookupClient.from('dynamic_table_records').select('*').eq('table_id', resolvedId).order('created_at', { ascending: false }).limit(limitParam)
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

function getAdminClientForAuth(): ReturnType<typeof createAdminClient> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function isAdminUser(supabase: any, userId: string): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return profile?.role === 'admin'
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, data: recordData } = body
  const tableId = body.table_id

  // Validate candidate_name — admin can assign any, employee only their assigned
  const candidateName = (recordData?.candidate_name || '').trim()
  if (!candidateName) return NextResponse.json({ error: 'Candidate Name is required' }, { status: 400 })
  const isAdmin = await isAdminUser(supabase, user.id)
  if (!isAdmin) {
    const lookupClient = getAdminClient() || supabase
    const [{ data: asOwner }, { data: asBackup }] = await Promise.all([
      lookupClient.from('Candidate_records').select('Candidate_name').eq('owner_id', user.id),
      lookupClient.from('Candidate_records').select('Candidate_name').eq('backup_employee_id', user.id),
    ])
    const validNames = new Set([
      ...(asOwner || []).map((c: any) => (c.Candidate_name || '').toLowerCase().trim()),
      ...(asBackup || []).map((c: any) => (c.Candidate_name || '').toLowerCase().trim()),
    ])
    if (!validNames.has(candidateName.toLowerCase())) {
      return NextResponse.json({ error: 'Candidate is not assigned to you' }, { status: 403 })
    }
  }

  let resolvedId = tableId || undefined
  if (!resolvedId) {
    const result = await getTableId(supabase, user.id)
    if (!result.id) return NextResponse.json({ error: result.error || 'Cannot find or create project table' }, { status: 500 })
    resolvedId = result.id
  }

  if (id) {
    const { error: updateErr } = await supabase.from('dynamic_table_records').update({ data: recordData, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Server-side duplicate check: same candidate + company + type + dates
  const lookupClient = getAdminClient() || supabase
  const { data: existing } = await lookupClient.from('dynamic_table_records').select('id, data').eq('table_id', resolvedId)
  const dup = (existing || []).some((r: any) =>
    String(r.data?.candidate_name ?? '').toLowerCase().trim() === String(recordData.candidate_name || '').toLowerCase().trim() &&
    String(r.data?.company_name ?? '').toLowerCase().trim() === String(recordData.company_name || '').toLowerCase().trim() &&
    String(r.data?.project_type ?? '').toLowerCase().trim() === String(recordData.project_type || '').toLowerCase().trim() &&
    String(r.data?.project_start_date ?? '').toLowerCase().trim() === String(recordData.project_start_date || '').toLowerCase().trim() &&
    String(r.data?.project_end_date ?? '').toLowerCase().trim() === String(recordData.project_end_date || '').toLowerCase().trim()
  )
  if (dup) return NextResponse.json({ error: 'An identical project record already exists' }, { status: 409 })

  const { data: inserted, error } = await supabase.from('dynamic_table_records').insert({
    table_id: resolvedId,
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

  const isAdmin = await isAdminUser(supabase, user.id)
  let query = supabase.from('dynamic_table_records').delete().eq('id', id)
  if (!isAdmin) query = query.eq('owner_id', user.id)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
