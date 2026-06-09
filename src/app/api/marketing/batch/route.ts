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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null

  const normalize = (s: string) => s.toLowerCase().trim()
  const denormalize = (s: string) => s.trim()

  const isValidISODate = (s: string | null) => {
    if (!s) return true
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime())
  }

  const MARKETING_STATUSES = new Set([
    'Initial Screening', 'Introductory call', 'Project Received',
    'RTR Confirmed', 'Screening Call', 'Technical Interview', 'Telephone Call',
  ])

  const MAX_RECORDS = 1000
  if (records.length > MAX_RECORDS) {
    return NextResponse.json({
      error: `Import limit is ${MAX_RECORDS} records per file. Your file contains ${records.length} records.`,
      imported: 0,
      total: records.length,
    }, { status: 400 })
  }

  // Gather unique candidate names from the import
  const rawCandidateNames = [...new Set(records.map((r: any) => (r.name || '').trim()).filter(Boolean))] as string[]

  // Fetch Candidate_records by name (using service role to bypass RLS)
  const lookupClient = supabaseAdmin || supabase
  let candidatesData: any[] = []
  if (rawCandidateNames.length > 0) {
    const { data } = await lookupClient
      .from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology')
      .in('Candidate_name', rawCandidateNames)
    candidatesData = data || []

    // Fallback: case-insensitive matching for names not found by exact match
    const foundCandidateNames = new Set(candidatesData.map(c => normalize(c.Candidate_name)))
    const unmatchedCandidates = rawCandidateNames.filter(n => !foundCandidateNames.has(normalize(n)))
    for (const cName of unmatchedCandidates) {
      const { data: fallback } = await lookupClient
        .from('Candidate_records')
        .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology')
        .ilike('Candidate_name', cName)
      if (fallback) {
        candidatesData = [...candidatesData, ...fallback]
      }
    }
  }

  // If non-admin, restrict to only candidates they are assigned to
  if (!isAdmin) {
    candidatesData = candidatesData.filter((c: any) =>
      c.owner_id === user.id || c.backup_employee_id === user.id
    )
  }

  // Resolve names for IDs found in Candidate_records (owner_id, backup_employee_id)
  const allCandIds = [...new Set([
    ...candidatesData.map((c: any) => c.owner_id).filter(Boolean),
    ...candidatesData.map((c: any) => c.backup_employee_id).filter(Boolean),
  ])] as string[]
  const idToName = new Map<string, string>()
  if (allCandIds.length > 0) {
    const [{ data: bp }, { data: be }] = await Promise.all([
      lookupClient.from('profiles').select('id, full_name').in('id', allCandIds),
      lookupClient.from('employees').select('user_id, full_name').in('user_id', allCandIds),
    ])
    for (const p of (bp || [])) if (p.full_name) idToName.set(p.id, p.full_name)
    for (const e of (be || [])) if (e.full_name) idToName.set(e.user_id, e.full_name)
  }

  // Build candidate lookup by normalized name + technology
  const candidateLookup = new Map<string, any>()
  for (const c of candidatesData) {
    const key = normalize(c.Candidate_name) + '|' + normalize(c.technology || '')
    if (!candidateLookup.has(key)) {
      candidateLookup.set(key, c)
    }
  }

  const now = new Date().toISOString()
  const insertRecords: any[] = []
  const errors: { name: string; issues: string[] }[] = []
  let closedCount = 0

  for (const r of records) {
    const issues: string[] = []
    const name = (r.name || '').trim()
    const technology = (r.technology || '').trim()

    if (!name) {
      issues.push('Row has no Candidate Name')
      errors.push({ name: '(empty)', issues })
      continue
    }

    // --- Step 1: Find candidate by name + technology ---
    const lookupKey = normalize(name) + '|' + normalize(technology)
    const candidateInfo = candidateLookup.get(lookupKey)

    if (!candidateInfo) {
      issues.push(`Candidate "${name}" with technology "${technology}" not found in All Candidates Records`)
      errors.push({ name, issues })
      continue
    }

    // --- Step 2: Check candidate status (Active / In-active / Closed) ---
    const candidateStatus = (candidateInfo.status || '').toLowerCase()
    const isClosed = candidateStatus === 'closed'

    if (isClosed) {
      closedCount++
    }

    // --- Step 3: Resolve primary employee from Candidate_records (NOT from Excel) ---
    const primaryUserId = candidateInfo.owner_id || user.id
    const primaryUserName = idToName.get(primaryUserId) || null

    // --- Step 4: Resolve backup employee from Candidate_records (NOT from Excel) ---
    const backupEmployeeName = candidateInfo.backup_employee_name
      || (candidateInfo.backup_employee_id ? idToName.get(candidateInfo.backup_employee_id) : null)
      || null

    // --- Step 5: Validate marketing status against pre-loaded list ---
    const rawStatus = (r.status || '').trim()
    const validStatus = MARKETING_STATUSES.has(rawStatus) ? rawStatus : 'Telephone Call'

    insertRecords.push({
      name,
      date: isValidISODate(r.date) ? r.date : null,
      status: validStatus,
      recruiter_name: r.recruiter_name || null,
      recruiter_email: r.recruiter_email || null,
      organization_name: r.organization_name || null,
      implementation_partner: r.implementation_partner || null,
      end_client: r.end_client || null,
      project_start_date: isValidISODate(r.project_start_date) ? r.project_start_date : null,
      project_end_date: isValidISODate(r.project_end_date) ? r.project_end_date : null,
      interview_date: isValidISODate(r.interview_date) ? r.interview_date : null,
      interview_type: r.interview_type || null,
      client_name: r.client_name || null,
      client_email: r.client_email || null,
      implementation_poc_email: r.implementation_poc_email || null,
      interviewer_email: r.interviewer_email || null,
      notes: r.notes || null,
      technology: technology || null,
      employee_name: primaryUserName,
      backup_employee_name: backupEmployeeName,
      owner_id: primaryUserId,
      created_at: now,
      updated_at: now,
    })
  }

  // If any candidate-not-found errors, reject entire batch
  if (errors.length > 0) {
    return NextResponse.json({
      error: 'Import validation failed. No records were imported.',
      errors,
      imported: 0,
      closed: closedCount,
      total: records.length,
    }, { status: 400 })
  }

  const insertedList: Array<{ id: string; name: string; owner_id: string }> = []
  if (insertRecords.length > 0) {
    const { data: inserted, error } = await supabase
      .from('marketing_records')
      .insert(insertRecords)
      .select('id, name, owner_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const item of (inserted || [])) insertedList.push(item)

    // --- Update Candidate_records with backup owner info ---
    if (supabaseAdmin) {
      const candidateUpdates = new Map<string, { backupName?: string }>()
      for (const r of insertRecords) {
        if (r.backup_employee_name && r.name) {
          const existing = candidateUpdates.get(normalize(r.name)) || {}
          if (r.backup_employee_name) existing.backupName = r.backup_employee_name
          candidateUpdates.set(normalize(r.name), existing)
        }
      }
      if (candidateUpdates.size > 0) {
        const allBackupNames = [...new Set(Array.from(candidateUpdates.values()).map(b => b.backupName).filter(Boolean))] as string[]
        let backupNameToId = new Map<string, string>()
        if (allBackupNames.length > 0) {
          const [bpResult, beResult] = await Promise.all([
            supabaseAdmin.from('profiles').select('id, full_name').in('full_name', allBackupNames),
            supabaseAdmin.from('employees').select('user_id, full_name').in('full_name', allBackupNames),
          ])
          for (const p of (bpResult.data || [])) if (p.full_name) backupNameToId.set(normalize(p.full_name), p.id)
          for (const e of (beResult.data || [])) if (e.full_name) backupNameToId.set(normalize(e.full_name), e.user_id)
        }
        for (const [actualCandidateName, update] of candidateUpdates) {
          const candidatePayload: any = {}
          if (update.backupName) {
            const userId = backupNameToId.get(normalize(update.backupName))
            if (userId) {
              candidatePayload.backup_employee_id = userId
              candidatePayload.backup_employee_name = denormalize(update.backupName)
            }
          }
          if (Object.keys(candidatePayload).length > 0) {
            await supabaseAdmin.from('Candidate_records').update(candidatePayload).eq('Candidate_name', actualCandidateName)
          }
        }
      }
    }

    // --- Audit log ---
    if (insertedList.length > 0) {
      const auditClient = supabaseAdmin || supabase
      await auditClient.from('audit_logs').insert(
        insertedList.map((r: any) => ({ action: 'created', entity_type: 'marketing_record', entity_id: r.id, user_id: user.id, created_at: now }))
      )
    }
  }

  return NextResponse.json({
    success: true,
    imported: insertedList.length - closedCount,
    closed: closedCount,
    errors,
    total: records.length,
  })
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
