import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ownerFilter = searchParams.get('owner_id')

  let data: any[] = []
  if (ownerFilter) {
    // Get records owned by this user
    const { data: ownedRecords } = await supabase
      .from('marketing_records')
      .select('*')
      .eq('owner_id', ownerFilter)
      .order('created_at', { ascending: false })

    // Also get records for candidates where user is backup employee
    const { data: backupCandidates } = await supabase
      .from('Candidate_records')
      .select('Candidate_name')
      .eq('backup_employee_id', ownerFilter)

    const backupNames = (backupCandidates || []).map(c => c.Candidate_name)
    let backupRecords: any[] = []
    if (backupNames.length > 0) {
      const { data: br } = await supabase
        .from('marketing_records')
        .select('*')
        .in('name', backupNames)
        .order('created_at', { ascending: false })
      backupRecords = br || []
    }

    // Merge and deduplicate
    const recordMap = new Map<string, any>()
    for (const r of (ownedRecords || [])) recordMap.set(r.id, { ...r, is_backup_record: false })
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
  const ownerIds = Array.from(new Set(data.map(r => r.owner_id).filter(Boolean)))
  let ownerNames: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
      supabase.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
    ])
    ownerNames = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name || p.email || 'Unknown employee']))
    for (const e of (employees || []) as any[]) {
      if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
    }
  }

  // Resolve backup employee names from Candidate_records
  const candidateNames = data.map(r => r.name).filter(Boolean)
  let backupNamesByCandidate: Record<string, string> = {}
  if (candidateNames.length > 0) {
    const { data: candidates } = await supabase
      .from('Candidate_records')
      .select('Candidate_name, backup_employee_id, backup_employee_name')
      .in('Candidate_name', candidateNames)

    // Collect backup employee IDs not already in ownerNames
    const candidateBackupIds = Array.from(new Set((candidates || []).map((c: any) => c.backup_employee_id).filter(Boolean))) as string[]
    const missingIds = candidateBackupIds.filter(id => !ownerNames[id])
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

    for (const c of (candidates || []) as any[]) {
      const name = (c as any).backup_employee_name || ((c as any).backup_employee_id ? ownerNames[(c as any).backup_employee_id] : null)
      if (name) backupNamesByCandidate[(c as any).Candidate_name] = name
    }
  }

  let lastReminderByRecord: Record<string, string> = {}
  if (data.length > 0) {
    const { data: reminderLogs } = await supabase
      .from('marketing_reminder_logs')
      .select('marketing_record_id, sent_at')
      .is('error', null)
      .in('marketing_record_id', data.map(r => r.id))
      .order('sent_at', { ascending: false })
    for (const log of (reminderLogs || []) as any[]) {
      if (!lastReminderByRecord[log.marketing_record_id]) {
        lastReminderByRecord[log.marketing_record_id] = log.sent_at
      }
    }
  }

  const enriched = data.map(r => ({
    ...r,
    status: (r as any).status || 'Telephone Call',
    employee_name: (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
    backup_employee_name: backupNamesByCandidate[r.name] || null,
    last_reminder_sent_at: lastReminderByRecord[r.id] || null,
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

  // If an admin created this record for a specific employee, look up that employee's info
  if (selectedEmployeeId) {
    effectiveOwnerId = selectedEmployeeId
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId).single()
    if (profile?.full_name) recordData.employee_name = profile.full_name
    const { data: employee } = await supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId).single()
    if (employee?.full_name) recordData.employee_name = employee.full_name
  } else if (!recordData.employee_name) {
    // Employee creating their own record — look up their own name
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    if (profile?.full_name) recordData.employee_name = profile.full_name
    const { data: employee } = await supabase.from('employees').select('full_name').eq('user_id', user.id).single()
    if (employee?.full_name) recordData.employee_name = employee.full_name
  }

  if (body.id) {
    // Check permissions: admin, owner, or backup employee can update
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
      // Check if user is backup employee for the candidate referenced by this record
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
    await supabase.from('audit_logs').insert({ action: 'updated', entity_type: 'marketing_record', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  const { data: inserted, error } = await supabase
    .from('marketing_records')
    .insert({ ...recordData, owner_id: effectiveOwnerId })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('audit_logs').insert({ action: 'created', entity_type: 'marketing_record', entity_id: inserted?.id || '', user_id: user.id, created_at: new Date().toISOString() })
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
  await supabase.from('audit_logs').insert({ action: 'deleted', entity_type: 'marketing_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })
  return NextResponse.json({ success: true })
}
