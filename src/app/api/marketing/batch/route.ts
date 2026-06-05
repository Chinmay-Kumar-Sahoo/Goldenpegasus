import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { records } = await req.json()
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'No records specified' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const insertRecords = records.map((r: any) => ({
    name: r.name,
    date: r.date || null,
    status: r.status || 'Telephone Call',
    recruiter_name: r.recruiter_name || null,
    recruiter_email: r.recruiter_email || null,
    organization_name: r.organization_name || null,
    implementation_partner: r.implementation_partner || null,
    end_client: r.end_client || null,
    project_start_date: r.project_start_date || null,
    project_end_date: r.project_end_date || null,
    interview_date: r.interview_date || null,
    interview_type: r.interview_type || null,
    client_name: r.client_name || null,
    client_email: r.client_email || null,
    implementation_poc_email: r.implementation_poc_email || null,
    interviewer_email: r.interviewer_email || null,
    notes: r.notes || null,
    employee_name: r.employee_name || null,
    owner_id: r.selectedEmployeeId || user.id,
    created_at: now,
    updated_at: now,
  }))

  const { data: inserted, error } = await supabase
    .from('marketing_records')
    .insert(insertRecords)
    .select('id, name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const insertedList = inserted || []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null

  const candidateBackupMap = new Map<string, { employeeName: string }>()
  for (const r of records) {
    if (r.backup_employee_name && r.name) {
      candidateBackupMap.set(r.name, { employeeName: r.backup_employee_name })
    }
  }

  if (candidateBackupMap.size > 0 && supabaseAdmin) {
    const backupNames = [...new Set(Array.from(candidateBackupMap.values()).map(b => b.employeeName))]
    const [profiles, employees] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name').in('full_name', backupNames),
      supabaseAdmin.from('employees').select('user_id, full_name').in('full_name', backupNames),
    ])
    const nameToId = new Map<string, string>()
    for (const p of (profiles.data || [])) if (p.full_name) nameToId.set(p.full_name, p.id)
    for (const e of (employees.data || [])) if (e.full_name) nameToId.set(e.full_name, e.user_id)

    for (const [candidateName, { employeeName }] of candidateBackupMap) {
      const userId = nameToId.get(employeeName)
      if (userId) {
        await supabaseAdmin
          .from('Candidate_records')
          .update({ backup_employee_id: userId, backup_employee_name: employeeName })
          .eq('Candidate_name', candidateName)
      }
    }
  }

  if (insertedList.length > 0) {
    await supabase.from('audit_logs').insert(
      insertedList.map((r: any) => ({ action: 'created', entity_type: 'marketing_record', entity_id: r.id, user_id: user.id, created_at: now }))
    )
  }

  return NextResponse.json({ success: true, count: insertRecords.length })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, updates } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No records specified' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  let query = supabase.from('marketing_records').update({ ...updates, updated_at: new Date().toISOString() }).in('id', ids)
  if (!isAdmin) query = query.eq('owner_id', user.id)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert(ids.map(id => ({ action: 'batch_updated', entity_type: 'marketing_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })))

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No records specified' }, { status: 400 })
  }

  const { error } = await supabase.from('marketing_records').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert(ids.map(id => ({ action: 'batch_deleted', entity_type: 'marketing_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })))

  return NextResponse.json({ success: true })
}
