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

  const EMAIL_FIELDS = ['recruiter_email', 'client_email', 'implementation_poc_email', 'interviewer_email'] as const

  const isValidEmail = (v: string | null) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

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

  // Fetch Candidate_records by name (case-insensitive ilike)
  const lookupClient = supabaseAdmin || supabase
  let candidatesData: any[] = []
  if (rawCandidateNames.length > 0) {
    const nameFilters = rawCandidateNames.map(n => `Candidate_name.ilike.${n}`).join(',')
    const { data } = await lookupClient
      .from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology, linkedin_url')
      .or(nameFilters)
    candidatesData = data || []
  }

  // Build set of all candidate names that exist (regardless of assignment)
  const allCandidateNameSet = new Set(candidatesData.map((c: any) => normalize(c.Candidate_name)))

  // Determine which candidates are accessible to the current user
  const accessibleRecords = !isAdmin
    ? candidatesData.filter((c: any) => c.owner_id === user.id || c.backup_employee_id === user.id)
    : candidatesData

  const accessibleNameSet = new Set(accessibleRecords.map((c: any) => normalize(c.Candidate_name)))

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

  // Build candidate lookups from ACCESSIBLE records only
  const candidateByName = new Map<string, any[]>()
  const candidateLookup = new Map<string, any>()
  for (const c of accessibleRecords) {
    const nameKey = normalize(c.Candidate_name)
    if (!candidateByName.has(nameKey)) candidateByName.set(nameKey, [])
    candidateByName.get(nameKey)!.push(c)

    const techKey = nameKey + '|' + normalize(c.technology || '')
    if (!candidateLookup.has(techKey)) {
      candidateLookup.set(techKey, c)
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

    // --- Step 1: Check Candidate Name exists in All Marketing Profiles ---
    const nameKey = normalize(name)

    // First, check if the candidate exists at all (regardless of owner)
    if (!allCandidateNameSet.has(nameKey)) {
      issues.push(`Candidate "${name}" does not exist in All Marketing Profiles`)
      errors.push({ name, issues })
      continue
    }

    // Next, for non-admin, check if the candidate is assigned to the current user
    if (!isAdmin && !accessibleNameSet.has(nameKey)) {
      issues.push(`Candidate "${name}" exists in All Marketing Profiles but is not assigned to you. Please contact an admin to assign this candidate.`)
      errors.push({ name, issues })
      continue
    }

    const nameMatches = candidateByName.get(nameKey)
    if (!nameMatches) {
      issues.push(`Candidate "${name}" row data unavailable. Please contact an admin.`)
      errors.push({ name, issues })
      continue
    }

    // --- Step 2: Check candidate Status (Active / In-active / Closed) ---
    // The status is the same across all technology rows for a candidate
    const firstMatch = nameMatches[0]
    const candidateStatus = (firstMatch.status || '').toLowerCase()
    const isClosed = candidateStatus === 'closed'
    if (isClosed) {
      closedCount++
    }

    // --- Step 3: Match Candidate Name + Technology ---
    const techKey = nameKey + '|' + normalize(technology)
    const candidateInfo = candidateLookup.get(techKey)

    if (!candidateInfo) {
      // Name exists but technology doesn't match — show specific error
      const availableTechs = nameMatches.map((c: any) => c.technology || '(no technology)').join(', ')
      issues.push(`Technology "${technology || '(none)'}" not found for candidate "${name}". Available technologies: ${availableTechs}`)
      errors.push({ name, issues })
      continue
    }

    // --- Step 4: Resolve Primary Employee and Backup Employee from the matched row ---
    const primaryUserId = candidateInfo.owner_id || user.id
    const primaryUserName = idToName.get(primaryUserId) || null
    const backupEmployeeName = candidateInfo.backup_employee_name
      || (candidateInfo.backup_employee_id ? idToName.get(candidateInfo.backup_employee_id) : null)
      || null

    // --- Step 5: Clean invalid email fields (silently clear, don't reject) ---
    for (const field of EMAIL_FIELDS) {
      const val = r[field]
      if (val && !isValidEmail(val)) {
        r[field] = null
      }
    }

    // --- Step 6: Validate Marketing Status against predefined list ---
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

  // If any validation errors, reject entire batch
  if (errors.length > 0) {
    return NextResponse.json({
      error: 'Import validation failed. No records were imported.',
      errors,
      imported: 0,
      closed: closedCount,
      total: records.length,
    }, { status: 400 })
  }

  // --- Dedup: skip records that already exist (same name+technology+owner_id) ---
  let skippedCount = 0
  if (insertRecords.length > 0) {
    const existingKeys = new Set<string>()
    const dedupKey = (r: any) => normalize(r.name || '') + '|' + normalize(r.technology || '') + '|' + (r.owner_id || '')
    // Query existing marketing_records that match any of the incoming name+owner_id combos
    const uniqueNameOwner = [...new Set(insertRecords.map(r => (r.name || '').trim() + '|||' + (r.owner_id || '')))]
    for (const pair of uniqueNameOwner) {
      const [n, oid] = pair.split('|||')
      if (!n || !oid) continue
      const { data: existing } = await supabase
        .from('marketing_records')
        .select('name, technology, owner_id')
        .eq('name', n)
        .eq('owner_id', oid)
      for (const ex of (existing || [])) {
        existingKeys.add(normalize(ex.name || '') + '|' + normalize(ex.technology || '') + '|' + (ex.owner_id || ''))
      }
    }
    const deduped: typeof insertRecords = []
    for (const r of insertRecords) {
      const key = dedupKey(r)
      if (existingKeys.has(key)) {
        skippedCount++
      } else {
        existingKeys.add(key)
        deduped.push(r)
      }
    }
    insertRecords.length = 0
    insertRecords.push(...deduped)
  }

  const insertedList: Array<{ id: string; name: string; owner_id: string }> = []
  if (insertRecords.length > 0) {
    const { data: inserted, error } = await supabase
      .from('marketing_records')
      .insert(insertRecords)
      .select('id, name, owner_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const item of (inserted || [])) insertedList.push(item)

    // --- Update Candidate_records with backup owner info (keyed by name|technology) ---
    if (supabaseAdmin) {
      const candidateUpdates = new Map<string, { backupName?: string }>()
      for (const r of insertRecords) {
        if (r.backup_employee_name && r.name) {
          const key = normalize(r.name) + '|' + normalize(r.technology || '')
          const existing = candidateUpdates.get(key) || {}
          if (r.backup_employee_name) existing.backupName = r.backup_employee_name
          candidateUpdates.set(key, existing)
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
        for (const [key, update] of candidateUpdates) {
          const [namePart, techPart] = key.split('|')
          const candidatePayload: any = {}
          if (update.backupName) {
            const userId = backupNameToId.get(normalize(update.backupName))
            if (userId) {
              candidatePayload.backup_employee_id = userId
              candidatePayload.backup_employee_name = denormalize(update.backupName)
            }
          }
          if (Object.keys(candidatePayload).length > 0) {
            const q = supabaseAdmin.from('Candidate_records').update(candidatePayload).ilike('Candidate_name', namePart)
            if (techPart) {
              await q.eq('technology', denormalize(techPart))
            } else {
              await q.is('technology', null)
            }
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
    skipped: skippedCount,
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
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let ids: string[]
    try {
      const body = await req.json()
      ids = body.ids
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No records specified' }, { status: 400 })
    }

    // Validate that all ids are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = ids.filter(id => typeof id !== 'string' || !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: `Invalid record ID format: ${JSON.stringify(invalidIds.slice(0, 3))}${invalidIds.length > 3 ? `... (${invalidIds.length} total)` : ''}` }, { status: 400 })
    }

    // Use service role client to bypass RLS (preferred), fall back to auth client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const deleteClient = (() => {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) return createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      return supabase
    })()

    // Delete in batches of 50 to avoid URL length issues with PostgREST .in() filter
    const BATCH_SIZE = 50
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      const { error: delError } = await deleteClient.from('marketing_records').delete().in('id', batch)
      if (delError) return NextResponse.json({ error: `Delete failed at batch ${i / BATCH_SIZE + 1}: ${delError.message}` }, { status: 500 })
    }

    const { error: auditError } = await deleteClient.from('audit_logs').insert(ids.map(id => ({ action: 'batch_deleted', entity_type: 'marketing_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })))
    if (auditError) return NextResponse.json({ error: `Audit log failed: ${auditError.message}` }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: `Unexpected error: ${err.message}` }, { status: 500 })
  }
}
