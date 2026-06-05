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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null

  const candidateNames = [...new Set(records.map((r: any) => r.name).filter(Boolean))] as string[]
  const primaryNames = [...new Set(records.map((r: any) => r.employee_name).filter(Boolean))] as string[]

  const [candidatesResult, profilesResult, employeesResult] = await Promise.all([
    supabase.from('Candidate_records').select('Candidate_name').in('Candidate_name', candidateNames.length > 0 ? candidateNames : ['']),
    supabase.from('profiles').select('id, full_name').in('full_name', primaryNames.length > 0 ? primaryNames : ['']),
    supabase.from('employees').select('user_id, full_name').in('full_name', primaryNames.length > 0 ? primaryNames : ['']),
  ])

  const normalize = (s: string) => s.toLowerCase().trim()
  const denormalize = (s: string) => s.trim()

  const existingCandidates = new Set((candidatesResult.data || []).map((c: any) => normalize(c.Candidate_name)))
  const candidateNameMap = new Map<string, string>()
  for (const c of (candidatesResult.data || [])) {
    if (c.Candidate_name) candidateNameMap.set(normalize(c.Candidate_name), c.Candidate_name)
  }
  const primaryEmployeeMap = new Map<string, string>()
  const employeeIdToName = new Map<string, string>()
  for (const p of (profilesResult.data || [])) {
    if (p.full_name) {
      primaryEmployeeMap.set(normalize(p.full_name), p.id)
      employeeIdToName.set(p.id, p.full_name)
    }
  }
  for (const e of (employeesResult.data || [])) {
    if (e.full_name) {
      primaryEmployeeMap.set(normalize(e.full_name), e.user_id)
      if (e.user_id && !employeeIdToName.has(e.user_id)) employeeIdToName.set(e.user_id, e.full_name)
    }
  }

  const now = new Date().toISOString()
  const validRecords: any[] = []
  const errors: { name: string; issues: string[] }[] = []

  for (const r of records) {
    const issues: string[] = []

    const candidateExists = r.name && existingCandidates.has(normalize(r.name))
    if (!candidateExists && r.employee_name && !primaryEmployeeMap.has(normalize(r.employee_name))) {
      issues.push('Candidate not in records and Primary Employee unresolved')
    }

    const primaryUserId = r.employee_name
      ? (primaryEmployeeMap.get(normalize(r.employee_name)) || null)
      : user.id

    if (r.employee_name && !primaryUserId) {
      issues.push('Primary Employee Not Found — record skipped')
      errors.push({ name: r.name || '(empty)', issues })
      continue
    }

    r._owner_id = primaryUserId
    r._candidateExists = candidateExists
    validRecords.push(r)
  }

  const insertedList: any[] = []
  if (validRecords.length > 0) {
    const insertRecords = validRecords.map((r: any) => ({
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
      employee_name: employeeIdToName.get(r._owner_id) || r.employee_name || null,
      owner_id: r._owner_id || user.id,
      created_at: now,
      updated_at: now,
    }))

    const { data: inserted, error } = await supabase
      .from('marketing_records')
      .insert(insertRecords)
      .select('id, name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const item of (inserted || [])) insertedList.push(item)

    if (supabaseAdmin) {
      const candidateBackupMap = new Map<string, { backupName: string; actualCandidateName: string }>()
      for (const r of validRecords) {
        if (r._candidateExists && r.backup_employee_name && r.name) {
          const actualName = candidateNameMap.get(normalize(r.name))
          if (actualName) {
            candidateBackupMap.set(actualName, { backupName: r.backup_employee_name, actualCandidateName: actualName })
          }
        }
      }
      if (candidateBackupMap.size > 0) {
        const allBackupNames = [...new Set(Array.from(candidateBackupMap.values()).map(b => b.backupName))] as string[]
        const [bpResult, beResult] = await Promise.all([
          supabaseAdmin.from('profiles').select('id, full_name').in('full_name', allBackupNames.length > 0 ? allBackupNames : ['']),
          supabaseAdmin.from('employees').select('user_id, full_name').in('full_name', allBackupNames.length > 0 ? allBackupNames : ['']),
        ])
        const backupNameToId = new Map<string, string>()
        for (const p of (bpResult.data || [])) if (p.full_name) backupNameToId.set(normalize(p.full_name), p.id)
        for (const e of (beResult.data || [])) if (e.full_name) backupNameToId.set(normalize(e.full_name), e.user_id)

        for (const { backupName, actualCandidateName } of candidateBackupMap.values()) {
          const userId = backupNameToId.get(normalize(backupName))
          if (userId) {
            await supabaseAdmin
              .from('Candidate_records')
              .update({ backup_employee_id: userId, backup_employee_name: denormalize(backupName) })
              .eq('Candidate_name', actualCandidateName)
          }
        }
      }
    }

    if (insertedList.length > 0) {
      await supabase.from('audit_logs').insert(
        insertedList.map((r: any) => ({ action: 'created', entity_type: 'marketing_record', entity_id: r.id, user_id: user.id, created_at: now }))
      )
    }
  }

  return NextResponse.json({ success: true, imported: validRecords.length, errors, total: records.length })
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
