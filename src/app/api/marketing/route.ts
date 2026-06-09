import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const MARKETING_FIELDS = 'id, owner_id, name, date, recruiter_name, recruiter_email, organization_name, implementation_partner, end_client, status, technology, project_start_date, project_end_date, interview_date, interview_type, client_name, client_email, implementation_poc_email, interviewer_email, notes, employee_name, backup_employee_name, created_at, updated_at'
const CANDIDATE_FIELDS = 'Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology'

let _adminClient: ReturnType<typeof createAdminClient> | null = null
function getAdminClient() {
  if (_adminClient) return _adminClient
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (key) _adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _adminClient
}

const MAX_RECORDS = 500

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const startTime = Date.now()
  const lookupClient = getAdminClient() || supabase

  const { searchParams } = new URL(req.url)
  const ownerFilter = searchParams.get('owner_id')
  const limitParam = Math.min(Number(searchParams.get('limit')) || MAX_RECORDS, MAX_RECORDS)

  let data: any[] = []
  if (ownerFilter) {
    const [ownedResult, backupCandidatesResult] = await Promise.all([
      supabase.from('marketing_records').select(MARKETING_FIELDS).eq('owner_id', ownerFilter).order('created_at', { ascending: false }).limit(limitParam),
      supabase.from('Candidate_records').select('Candidate_name').eq('backup_employee_id', ownerFilter),
    ])

    const ownedRecords = ownedResult.data || []
    const backupCandidates = backupCandidatesResult.data || []
    const backupNames = backupCandidates.map(c => c.Candidate_name)

    let backupRecords: any[] = []
    if (backupNames.length > 0) {
      const { data: br } = await supabase
        .from('marketing_records')
        .select(MARKETING_FIELDS)
        .in('name', backupNames)
        .order('created_at', { ascending: false })
        .limit(limitParam)
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
      .select(MARKETING_FIELDS)
      .order('created_at', { ascending: false })
      .limit(limitParam)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = allRecords || []
  }

  if (data.length === 0) {
    return NextResponse.json({ records: [], timing: Date.now() - startTime })
  }

  const ownerIds = Array.from(new Set(data.map(r => r.owner_id).filter(Boolean) as string[]))
  const candidateNames = [...new Set(data.map(r => r.name).filter(Boolean))] as string[]

  const [ownerNamesResult, candidatesResult, reminderResult] = await Promise.all([
    ownerIds.length > 0
      ? (async () => {
          const [{ data: profiles }, { data: employees }] = await Promise.all([
            lookupClient.from('profiles').select('id, full_name, email').in('id', ownerIds),
            lookupClient.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
          ])
          const names: Record<string, string> = {}
          for (const p of (profiles || [])) if (p.id) names[p.id] = p.full_name || p.email || 'Unknown employee'
          for (const e of (employees || [])) if (e.user_id) names[e.user_id] = e.full_name || e.email || names[e.user_id] || 'Unknown employee'
          return names
        })()
      : Promise.resolve({} as Record<string, string>),
    candidateNames.length > 0
      ? (async () => {
          // Try exact match first, then case-insensitive fallback for unmatched names
          const { data: exact } = await lookupClient.from('Candidate_records').select(CANDIDATE_FIELDS).in('Candidate_name', candidateNames)
          const exactSet = new Set((exact || []).map((c: any) => c.Candidate_name.toLowerCase().trim()))
          const unmatched = candidateNames.filter(n => !exactSet.has(n.toLowerCase().trim()))
          if (unmatched.length === 0) return { data: exact || [] }
          // Fetch unmatched candidates with case-insensitive matching
          const ilikeFilters = unmatched.map(n => `Candidate_name.ilike.${n}`).join(',')
          const { data: fallback } = await lookupClient.from('Candidate_records').select(CANDIDATE_FIELDS).or(ilikeFilters)
          return { data: [...(exact || []), ...(fallback || [])] }
        })()
      : Promise.resolve({ data: [] }),
    lookupClient.from('marketing_reminder_logs').select('marketing_record_id, sent_at').is('error', null).in('marketing_record_id', data.map(r => r.id)).order('sent_at', { ascending: false }),
  ])

  const ownerNames = ownerNamesResult
  const candidatesData = candidatesResult.data || []
  const reminderLogs = reminderResult.data || []

  // Filter out records whose candidate status is Closed (normalised keys)
  const candidateStatusMap = new Map<string, string>()
  for (const c of candidatesData as any[]) {
    if (c.Candidate_name && c.status) candidateStatusMap.set(c.Candidate_name.toLowerCase().trim(), c.status)
  }
  data = data.filter(r => {
    const status = candidateStatusMap.get((r.name || '').toLowerCase().trim())
    return !status || status !== 'Closed'
  })
  if (data.length === 0) {
    return NextResponse.json({ records: [], timing: Date.now() - startTime })
  }

  const candidateBackupIds = Array.from(new Set(candidatesData.map((c: any) => c.backup_employee_id).filter(Boolean))) as string[]
  const candidateOwnerIds = Array.from(new Set(candidatesData.map((c: any) => c.owner_id).filter(Boolean))) as string[]
  const missingIds = Array.from(new Set([...candidateBackupIds, ...candidateOwnerIds])).filter(id => !ownerNames[id])

  if (missingIds.length > 0) {
    const [{ data: bp }, { data: be }] = await Promise.all([
      lookupClient.from('profiles').select('id, full_name, email').in('id', missingIds),
      lookupClient.from('employees').select('user_id, full_name, email').in('user_id', missingIds),
    ])
    for (const p of (bp || []) as any[]) {
      if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
    }
    for (const e of (be || []) as any[]) {
      if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
    }
  }

  // Build lookup by candidate name + technology (normalized keys)
  const backupNamesByCandidate: Record<string, string> = {}
  const primaryOwnerByCandidate: Record<string, string> = {}
  for (const c of candidatesData as any[]) {
    const key = (c.Candidate_name || '').toLowerCase().trim() + '|' + (c.technology || '').toLowerCase().trim()
    const backupName = c.backup_employee_name || (c.backup_employee_id ? ownerNames[c.backup_employee_id] : null)
    if (backupName) backupNamesByCandidate[key] = backupName
    if (c.owner_id && ownerNames[c.owner_id]) {
      primaryOwnerByCandidate[key] = ownerNames[c.owner_id]
    }
  }

  const lastReminderByRecord: Record<string, string> = {}
  for (const log of reminderLogs as any[]) {
    if (!lastReminderByRecord[log.marketing_record_id]) {
      lastReminderByRecord[log.marketing_record_id] = log.sent_at
    }
  }

  const enriched = data.map(r => {
    const lookupKey = (r.name || '').toLowerCase().trim() + '|' + (r.technology || '').toLowerCase().trim()
    return {
      ...r,
      status: (r as any).status || 'Telephone Call',
      employee_name: primaryOwnerByCandidate[lookupKey] || (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
      backup_employee_name: backupNamesByCandidate[lookupKey] || (r as any).backup_employee_name || null,
      technology: (r as any).technology || null,
      last_reminder_sent_at: lastReminderByRecord[r.id] || null,
    }
  })

  return NextResponse.json({ records: enriched, timing: Date.now() - startTime })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { selectedEmployeeId, ...recordData } = body

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdminUser = profile?.role === 'admin'

  let effectiveOwnerId = user.id
  let employeeName = recordData.employee_name || null

  // When creating a new record with candidate name + technology, auto-fill from Candidate_records
  if (!body.id && recordData.name) {
    const { data: candidates } = await supabase
      .from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name, technology')
      .eq('Candidate_name', recordData.name)

    // If technology is provided, find the matching Candidate_records row
    const matchedCandidate = candidates && candidates.length > 0
      ? (recordData.technology
          ? candidates.find(
              (c: any) => (c.technology || '').toLowerCase().trim() === (recordData.technology || '').toLowerCase().trim()
            ) || candidates[0]
          : candidates[0])
      : null

    if (matchedCandidate) {
      if (selectedEmployeeId) {
        effectiveOwnerId = selectedEmployeeId
        const [pResult, eResult] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId).single(),
          supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId).single(),
        ])
        employeeName = pResult.data?.full_name || eResult.data?.full_name || null
      } else {
        effectiveOwnerId = matchedCandidate.owner_id || user.id
        // Resolve employee name
        const ownerId = matchedCandidate.owner_id
        if (ownerId) {
          const [pResult, eResult] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('id', ownerId).single(),
            supabase.from('employees').select('full_name').eq('user_id', ownerId).single(),
          ])
          employeeName = pResult.data?.full_name || eResult.data?.full_name || null
        }
      }

      // Auto-fill backup employee name if not provided
      if (!recordData.backup_employee_name && matchedCandidate.backup_employee_name) {
        recordData.backup_employee_name = matchedCandidate.backup_employee_name
      }
      if (!recordData.backup_employee_name && matchedCandidate.backup_employee_id) {
        const [pResult, eResult] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', matchedCandidate.backup_employee_id).single(),
          supabase.from('employees').select('full_name').eq('user_id', matchedCandidate.backup_employee_id).single(),
        ])
        recordData.backup_employee_name = pResult.data?.full_name || eResult.data?.full_name || null
      }

      // Auto-fill technology from candidate
      if (!recordData.technology && matchedCandidate.technology) {
        recordData.technology = matchedCandidate.technology
      }
    } else if (selectedEmployeeId) {
      effectiveOwnerId = selectedEmployeeId
      const [pResult, eResult] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId).single(),
        supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId).single(),
      ])
      employeeName = pResult.data?.full_name || eResult.data?.full_name || null
    }
  } else if (selectedEmployeeId) {
    effectiveOwnerId = selectedEmployeeId
    const [pResult, eResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId).single(),
      supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId).single(),
    ])
    employeeName = pResult.data?.full_name || eResult.data?.full_name || null
  }

  // Update employee_name from effective owner if not set
  if (!employeeName && effectiveOwnerId) {
    const [pResult, eResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', effectiveOwnerId).single(),
      supabase.from('employees').select('full_name').eq('user_id', effectiveOwnerId).single(),
    ])
    employeeName = pResult.data?.full_name || eResult.data?.full_name || null
  }

  if (body.id) {
    // --- EDITING EXISTING RECORD ---
    const { data: existingRecord } = await supabase
      .from('marketing_records')
      .select('owner_id, name, technology')
      .eq('id', body.id)
      .single()

    if (!existingRecord) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

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

    const { date, employee_name: _, ...updatableFields } = recordData
    // Non-admin should not update employee meta fields
    if (!isAdminUser) {
      delete updatableFields.backup_employee_name
    }
    const updatePayload: any = { ...updatableFields, updated_at: new Date().toISOString() }

    // Admin can edit date
    if (isAdminUser && date !== undefined) {
      updatePayload.date = date || null
    }

    // Admin can edit employee_name on existing records
    if (isAdminUser && employeeName) {
      updatePayload.employee_name = employeeName
      if (effectiveOwnerId) {
        updatePayload.owner_id = effectiveOwnerId
      }
    }

    // Admin can edit backup_employee_name on existing records
    if (isAdminUser && recordData.backup_employee_name !== undefined) {
      updatePayload.backup_employee_name = recordData.backup_employee_name || null
    }

    const { error } = await client
      .from('marketing_records')
      .update(updatePayload)
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If admin changed owner, sync to Candidate_records and related marketing records (by name+technology)
    if (isAdminUser && effectiveOwnerId && effectiveOwnerId !== existingRecord.owner_id) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
        // Update specific Candidate_records row (name + technology)
        const candQ = adminClient.from('Candidate_records').update({ owner_id: effectiveOwnerId, updated_at: new Date().toISOString() }).eq('Candidate_name', existingRecord.name)
        if (existingRecord.technology) {
          await candQ.eq('technology', existingRecord.technology)
        } else {
          await candQ.is('technology', null)
        }

        // Update marketing records with matching name + technology
        const mktQ = adminClient.from('marketing_records').update({ owner_id: effectiveOwnerId, employee_name: employeeName, updated_at: new Date().toISOString() }).eq('name', existingRecord.name)
        if (existingRecord.technology) {
          await mktQ.eq('technology', existingRecord.technology)
        } else {
          await mktQ.is('technology', null)
        }
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'updated', entity_type: 'marketing_record', entity_id: body.id,
      user_id: user.id, created_at: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  }

  // --- CREATING NEW RECORD ---
  const insertData: any = {
    ...recordData,
    owner_id: effectiveOwnerId,
    employee_name: employeeName || null,
  }
  delete insertData.selectedEmployeeId
  delete insertData.id

  const { data: inserted, error } = await supabase
    .from('marketing_records')
    .insert(insertData)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If admin assigned a different employee, sync to Candidate_records (by name+technology)
  if (isAdminUser && selectedEmployeeId && recordData.name) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const q = adminClient.from('Candidate_records').update({ owner_id: selectedEmployeeId, updated_at: new Date().toISOString() }).eq('Candidate_name', recordData.name)
      const tech = recordData.technology
      if (tech) {
        await q.eq('technology', tech)
      } else {
        await q.is('technology', null)
      }
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'created', entity_type: 'marketing_record', entity_id: inserted?.id || '',
    user_id: user.id, created_at: new Date().toISOString(),
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
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
