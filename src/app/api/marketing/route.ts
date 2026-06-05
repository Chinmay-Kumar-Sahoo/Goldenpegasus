import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ownerFilter = searchParams.get('owner_id')

  const startTime = Date.now()

  let data: any[] = []
  if (ownerFilter) {
    const [ownedResult, backupCandidatesResult] = await Promise.all([
      supabase.from('marketing_records').select('*').eq('owner_id', ownerFilter).order('created_at', { ascending: false }),
      supabase.from('Candidate_records').select('Candidate_name').eq('backup_employee_id', ownerFilter),
    ])

    const ownedRecords = ownedResult.data || []
    const backupCandidates = backupCandidatesResult.data || []
    const backupNames = backupCandidates.map(c => c.Candidate_name)

    let backupRecords: any[] = []
    if (backupNames.length > 0) {
      const { data: br } = await supabase
        .from('marketing_records')
        .select('*')
        .in('name', backupNames)
        .order('created_at', { ascending: false })
      backupRecords = br || []
    }

    const recordMap = new Map<string, any>()
    for (const r of ownedRecords) recordMap.set(r.id, { ...r, is_backup_record: false })
    for (const r of backupRecords) {
      if (!recordMap.has(r.id)) recordMap.set(r.id, { ...r, is_backup_record: r.owner_id !== ownerFilter })
    }
    data = Array.from(recordMap.values())
  } else {
    const { data: allRecords, error } = await supabase
      .from('marketing_records')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = allRecords || []
  }

  if (data.length === 0) {
    return NextResponse.json({ records: [], timing: Date.now() - startTime })
  }

  const ownerIds = Array.from(new Set(data.map(r => r.owner_id).filter(Boolean) as string[]))
  const candidateNames = data.map(r => r.name).filter(Boolean)

  const [ownerNamesResult, candidatesResult, reminderResult] = await Promise.all([
    ownerIds.length > 0
      ? (async () => {
          const [{ data: profiles }, { data: employees }] = await Promise.all([
            supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
            supabase.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
          ])
          const names: Record<string, string> = {}
          for (const p of (profiles || [])) if (p.id) names[p.id] = p.full_name || p.email || 'Unknown employee'
          for (const e of (employees || [])) if (e.user_id) names[e.user_id] = e.full_name || e.email || names[e.user_id] || 'Unknown employee'
          return names
        })()
      : Promise.resolve({} as Record<string, string>),
    candidateNames.length > 0
      ? supabase.from('Candidate_records').select('Candidate_name, owner_id, backup_employee_id, backup_employee_name').in('Candidate_name', candidateNames)
      : Promise.resolve({ data: [] }),
    supabase.from('marketing_reminder_logs').select('marketing_record_id, sent_at').is('error', null).in('marketing_record_id', data.map(r => r.id)).order('sent_at', { ascending: false }),
  ])

  const ownerNames = ownerNamesResult
  const candidates = candidatesResult.data || []
  const reminderLogs = reminderResult.data || []

  const candidateBackupIds = Array.from(new Set(candidates.map((c: any) => c.backup_employee_id).filter(Boolean))) as string[]
  const candidateOwnerIds = Array.from(new Set(candidates.map((c: any) => c.owner_id).filter(Boolean))) as string[]
  const missingIds = Array.from(new Set([...candidateBackupIds, ...candidateOwnerIds])).filter(id => !ownerNames[id])

  if (missingIds.length > 0) {
    const [{ data: bp }, { data: be }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', missingIds),
      supabase.from('employees').select('user_id, full_name, email').in('user_id', missingIds),
    ])
    for (const p of (bp || []) as any[]) {
      if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
    }
    for (const e of (be || []) as any[]) {
      if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
    }
  }

  const backupNamesByCandidate: Record<string, string> = {}
  const primaryOwnerByCandidate: Record<string, string> = {}
  for (const c of candidates as any[]) {
    const name = c.backup_employee_name || (c.backup_employee_id ? ownerNames[c.backup_employee_id] : null)
    if (name) backupNamesByCandidate[c.Candidate_name] = name
    if (c.owner_id && ownerNames[c.owner_id]) {
      primaryOwnerByCandidate[c.Candidate_name] = ownerNames[c.owner_id]
    }
  }

  const lastReminderByRecord: Record<string, string> = {}
  for (const log of reminderLogs as any[]) {
    if (!lastReminderByRecord[log.marketing_record_id]) {
      lastReminderByRecord[log.marketing_record_id] = log.sent_at
    }
  }

  const enriched = data.map(r => ({
    ...r,
    status: (r as any).status || 'Telephone Call',
    employee_name: primaryOwnerByCandidate[r.name] || (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
    backup_employee_name: backupNamesByCandidate[r.name] || null,
    last_reminder_sent_at: lastReminderByRecord[r.id] || null,
  }))

  return NextResponse.json({ records: enriched, timing: Date.now() - startTime })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { selectedEmployeeId, backup_employee_name: importBackupName, ...recordData } = body

  let effectiveOwnerId = user.id

  if (selectedEmployeeId) {
    effectiveOwnerId = selectedEmployeeId
    const [profileResult, employeeResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId).single(),
      supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId).single(),
    ])
    if (profileResult.data?.full_name) recordData.employee_name = profileResult.data.full_name
    if (employeeResult.data?.full_name) recordData.employee_name = employeeResult.data.full_name
  } else if (!recordData.employee_name) {
    const [profileResult, employeeResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('employees').select('full_name').eq('user_id', user.id).single(),
    ])
    if (profileResult.data?.full_name) recordData.employee_name = profileResult.data.full_name
    if (employeeResult.data?.full_name) recordData.employee_name = employeeResult.data.full_name
  }

  if (importBackupName && body.name) {
    const [backupProfileResult, backupEmployeeResult] = await Promise.all([
      supabase.from('profiles').select('id').eq('full_name', importBackupName).maybeSingle(),
      supabase.from('employees').select('user_id').eq('full_name', importBackupName).maybeSingle(),
    ])
    const backupUserId = backupProfileResult.data?.id || backupEmployeeResult.data?.user_id
    if (backupUserId) {
      await supabase
        .from('Candidate_records')
        .update({ backup_employee_id: backupUserId, backup_employee_name: importBackupName })
        .eq('Candidate_name', body.name)
    }
  }

  if (body.id) {
    const { data: existingRecord } = await supabase
      .from('marketing_records')
      .select('owner_id, name')
      .eq('id', body.id)
      .single()

    if (!existingRecord) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdminUser = profile?.role === 'admin'

    if (!isAdminUser && existingRecord.owner_id !== user.id) {
      const { data: candidate } = await supabase
        .from('Candidate_records')
        .select('id')
        .eq('Candidate_name', existingRecord.name)
        .eq('backup_employee_id', user.id)
        .maybeSingle()

      if (!candidate) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    let client = supabase
    if (!isAdminUser) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        const { createClient } = await import('@supabase/supabase-js')
        client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      }
    }

    const { error } = await client
      .from('marketing_records')
      .update({ ...recordData, updated_at: new Date().toISOString() })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_logs').insert({
      action: 'updated', entity_type: 'marketing_record', entity_id: body.id,
      user_id: user.id, created_at: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  }

  const { data: inserted, error } = await supabase
    .from('marketing_records')
    .insert({ ...recordData, owner_id: effectiveOwnerId })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert({
    action: 'created', entity_type: 'marketing_record', entity_id: inserted?.id || '',
    user_id: user.id, created_at: new Date().toISOString(),
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { error } = await supabase.from('marketing_records').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert({
    action: 'deleted', entity_type: 'marketing_record', entity_id: id,
    user_id: user.id, created_at: new Date().toISOString(),
  })
  return NextResponse.json({ success: true })
}
