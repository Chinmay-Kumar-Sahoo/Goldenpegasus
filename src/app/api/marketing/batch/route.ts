import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMAIL_FIELDS = ['recruiter_email', 'client_email', 'implementation_poc_email', 'interviewer_email'] as const

const isValidEmail = (v: string | null) => !v || /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v)

const COMPANY_VARIATIONS: Record<string, string> = {
  'techm': 'Tech Mahindra',
  'tech mahindra': 'Tech Mahindra',
  'tech mahindra limited': 'Tech Mahindra',
  'mahindra': 'Tech Mahindra',
  'infosys': 'Infosys',
  'infy': 'Infosys',
  'tcs': 'TCS',
  'tata consultancy services': 'TCS',
  'tata consultancy': 'TCS',
  'wipro': 'Wipro',
  'wipro limited': 'Wipro',
  'wipro technologies': 'Wipro',
  'hcl': 'HCL',
  'hcl technologies': 'HCL',
  'hcl tech': 'HCL',
  'accenture': 'Accenture',
  'accenture technology': 'Accenture',
  'accenture technologies': 'Accenture',
  'cognizant': 'Cognizant',
  'cognizant technology solutions': 'Cognizant',
  'cts': 'Cognizant',
  'ibm': 'IBM',
  'i.b.m.': 'IBM',
  'capgemini': 'Capgemini',
  'capg': 'Capgemini',
  'lti': 'LTI',
  'l&t infotech': 'LTI',
  'larsen & toubro infotech': 'LTI',
  'mindtree': 'Mindtree',
  'ltimindtree': 'LTI Mindtree',
  'dell': 'Dell',
  'dell technologies': 'Dell',
  'deloitte': 'Deloitte',
  'deloitte consulting': 'Deloitte',
  'epam': 'EPAM',
  'epam systems': 'EPAM',
  'mphasis': 'Mphasis',
  'hexaware': 'Hexaware',
  'hexaware technologies': 'Hexaware',
  'persistent': 'Persistent',
  'persistent systems': 'Persistent',
  'synechron': 'Synechron',
  'teksystems': 'TekSystems',
  'tek systems': 'TekSystems',
  'randstad': 'Randstad',
  'randstad technologies': 'Randstad',
}
const normalizeCompanyName = (value: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  const key = trimmed.toLowerCase()
  return COMPANY_VARIATIONS[key] || trimmed
}

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

  const normalize = (s: string) => s.replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u180E\u2060\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
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

  // Fetch ALL candidate records (no name pre-filter) — avoids PostgREST .or().ilike() parsing edge cases
  const lookupClient = supabaseAdmin || supabase
  const [{ data: candidatesData }, { data: bp }, { data: be }] = await Promise.all([
    lookupClient.from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology, linkedin_url')
      .limit(2000),
    lookupClient.from('profiles').select('id, full_name'),
    lookupClient.from('employees').select('user_id, full_name'),
  ])
  const allCandidates = candidatesData || []
  const profilesData = bp || []
  const employeesData = be || []

  // Build set of ALL candidate names that exist (regardless of assignment)
  const allCandidateNameSet = new Set(allCandidates.map((c: any) => normalize(c.Candidate_name)))

  // Determine which candidates are accessible to the current user
  const accessibleRecords = !isAdmin
    ? allCandidates.filter((c: any) => c.owner_id === user.id || c.backup_employee_id === user.id)
    : allCandidates

  const accessibleNameSet = new Set(accessibleRecords.map((c: any) => normalize(c.Candidate_name)))

  // Resolve names for IDs found in Candidate_records
  const idToName = new Map<string, string>()
  for (const p of profilesData) if (p.full_name) idToName.set(p.id, p.full_name)
  for (const e of employeesData) if (e.full_name) idToName.set(e.user_id, e.full_name)

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

  // ── DB-wide dedup preparation ─────────────────────────────────────────
  const dedupFields = ['name', 'date', 'status', 'recruiter_name', 'recruiter_email', 'organization_name', 'implementation_partner', 'end_client', 'project_start_date', 'project_end_date', 'interview_date', 'interview_type', 'client_name', 'client_email', 'implementation_poc_email', 'interviewer_email', 'technology', 'owner_id']
  const buildFullKey = (r: any) => {
    const parts = dedupFields.map(f => normalize(String(r[f] ?? '') || ''))
    return parts.join('|||')
  }
  const importNames = [...new Set(records.map((r: any) => (r.name || '').trim()).filter(Boolean))]
  let existingDedupKeys = new Set<string>()
  if (importNames.length > 0) {
    const { data: existingRecords } = await lookupClient
      .from('marketing_records')
      .select(dedupFields.join(', '))
      .in('name', importNames)
    if (existingRecords) {
      for (const r of existingRecords) {
        existingDedupKeys.add(buildFullKey(r))
      }
    }
  }

  for (const r of records) {
    const issues: string[] = []
    const name = (r.name || '').trim()
    const technology = (r.technology || '').trim()

    if (!name) {
      issues.push('Row has no Candidate Name')
      errors.push({ name: '(empty)', issues })
      continue
    }

    // --- Require at least one additional data field ---
    const dataFields = ['date', 'recruiter_name', 'recruiter_email', 'organization_name', 'implementation_partner', 'end_client', 'project_start_date', 'project_end_date', 'interview_date', 'interview_type', 'client_name', 'client_email', 'implementation_poc_email', 'interviewer_email', 'notes', 'technology']
    const hasData = dataFields.some(f => {
      const v = r[f]
      return v !== null && v !== undefined && String(v).trim() !== ''
    })
    if (!hasData) {
      issues.push(`Row for "${name}" has no data in any field beyond name`)
      errors.push({ name, issues })
      continue
    }

    // --- Step 1: Check Candidate Name exists in All Candidate Profiles ---
    const nameKey = normalize(name)

    // First, check if the candidate exists at all (regardless of owner)
    if (!allCandidateNameSet.has(nameKey)) {
      issues.push(`Candidate "${name}" does not exist in All Candidate Profiles`)
      errors.push({ name, issues })
      continue
    }

    // Next, for non-admin, check if the candidate is assigned to the current user
    if (!isAdmin && !accessibleNameSet.has(nameKey)) {
      issues.push(`Candidate "${name}" exists in All Candidate Profiles but is not assigned to you. Please contact an admin to assign this candidate.`)
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

    const recordToInsert = {
      name,
      date: isValidISODate(r.date) ? r.date : null,
      status: validStatus,
      recruiter_name: r.recruiter_name || null,
      recruiter_email: r.recruiter_email || null,
      organization_name: normalizeCompanyName(r.organization_name),
      implementation_partner: normalizeCompanyName(r.implementation_partner),
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
    }

    // Check against existing DB records for duplicates
    const dedupKey = buildFullKey(recordToInsert)
    if (existingDedupKeys.has(dedupKey)) {
      issues.push('Duplicate Profile — a record with identical details already exists in the database')
      errors.push({ name, issues })
      continue
    }

    insertRecords.push(recordToInsert)
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

  // --- Dedup: skip duplicate records within the import batch only ---
  // DB-wide dedup is performed above, before any records are inserted
  let skippedCount = 0
  if (insertRecords.length > 0) {
    const batchDeduped: typeof insertRecords = []
    const batchSeen = new Set<string>()
    for (const r of insertRecords) {
      const key = buildFullKey(r)
      if (batchSeen.has(key)) {
        skippedCount++
      } else {
        batchSeen.add(key)
        batchDeduped.push(r)
      }
    }
    insertRecords.length = 0
    insertRecords.push(...batchDeduped)
  }

  const insertedList: Array<{ id: string; name: string; owner_id: string }> = []
  if (insertRecords.length > 0) {
    const { data: inserted, error } = await supabase
      .from('marketing_records')
      .insert(insertRecords)
      .select('id, name, owner_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const item of (inserted || [])) insertedList.push(item)

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

  // Validate email fields
  for (const field of EMAIL_FIELDS) {
    const val = updates[field]
    if (val && !isValidEmail(val)) {
      return NextResponse.json({ error: `Invalid email format for ${field}` }, { status: 400 })
    }
  }

  // Normalize company name fields
  if (updates.organization_name) updates.organization_name = normalizeCompanyName(updates.organization_name)
  if (updates.implementation_partner) updates.implementation_partner = normalizeCompanyName(updates.implementation_partner)

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
