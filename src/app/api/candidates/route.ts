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
  const backupIds = Array.from(new Set(records.map(r => (r as any).backup_employee_id).filter(Boolean)))
  const allIds = Array.from(new Set([...ownerIds, ...backupIds]))
  const [{ data: profiles }, { data: employees }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', allIds.length > 0 ? allIds : ['']),
    supabase.from('employees').select('user_id, full_name, email').in('user_id', allIds.length > 0 ? allIds : ['']),
  ])
  const ownerNames: Record<string, string> = {}
  for (const p of (profiles || [])) if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
  for (const e of (employees || [])) if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'

  const enriched = records.map(r => ({
    ...r,
    employee_name: ownerNames[r.owner_id] || null,
    backup_employee_name: (r as any).backup_employee_name || ((r as any).backup_employee_id ? ownerNames[(r as any).backup_employee_id] : null) || null,
  }))

  return NextResponse.json({ records: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { selectedEmployeeId, backupEmployeeId, ...recordData } = body

  let effectiveOwnerId = user.id
  if (selectedEmployeeId) {
    effectiveOwnerId = selectedEmployeeId
  }

  let backupName: string | null = null
  if (backupEmployeeId) {
    const { data: bp } = await supabase.from('profiles').select('full_name').eq('id', backupEmployeeId).single()
    if (bp?.full_name) backupName = bp.full_name
    const { data: be } = await supabase.from('employees').select('full_name').eq('user_id', backupEmployeeId).single()
    if (be?.full_name) backupName = be.full_name
  }

  if (body.id) {
    const updateData: any = { ...recordData, updated_at: new Date().toISOString() }
    if (backupEmployeeId !== undefined) updateData.backup_employee_id = backupEmployeeId || null
    if (backupName !== null) updateData.backup_employee_name = backupName
    const { error } = await supabase
      .from('Candidate_records')
      .update(updateData)
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'updated', entity_type: 'candidate_record', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  const insertData: any = { ...recordData, owner_id: effectiveOwnerId }
  if (backupEmployeeId) {
    insertData.backup_employee_id = backupEmployeeId
    if (backupName) insertData.backup_employee_name = backupName
  }
  const { data: inserted, error } = await supabase
    .from('Candidate_records')
    .insert(insertData)
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
