import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('Candidate_records')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const records = data || []
  const ownerIds = Array.from(new Set(records.map(r => r.owner_id).filter(Boolean)))
  const [{ data: profiles }, { data: employees }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', ownerIds.length > 0 ? ownerIds : ['']),
    supabase.from('employees').select('user_id, full_name, email').in('user_id', ownerIds.length > 0 ? ownerIds : ['']),
  ])
  const ownerNames: Record<string, string> = {}
  for (const p of (profiles || [])) if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
  for (const e of (employees || [])) if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'

  const enriched = records.map(r => ({
    ...r,
    employee_name: ownerNames[r.owner_id] || null,
  }))

  return NextResponse.json({ records: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { selectedEmployeeId, ...recordData } = body

  let effectiveOwnerId = user.id
  if (selectedEmployeeId) {
    effectiveOwnerId = selectedEmployeeId
  }

  if (body.id) {
    const { error } = await supabase
      .from('Candidate_records')
      .update({ ...recordData, updated_at: new Date().toISOString() })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'updated', entity_type: 'candidate_record', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  const { data: inserted, error } = await supabase
    .from('Candidate_records')
    .insert({ ...recordData, owner_id: effectiveOwnerId })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('audit_logs').insert({ action: 'created', entity_type: 'candidate_record', entity_id: inserted?.id || '', user_id: user.id, created_at: new Date().toISOString() })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('Candidate_records').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('audit_logs').insert({ action: 'deleted', entity_type: 'candidate_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })
  return NextResponse.json({ success: true })
}
