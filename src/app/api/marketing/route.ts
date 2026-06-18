import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const MARKETING_FIELDS = 'id, owner_id, name, date, date_locked, recruiter_name, recruiter_email, organization_name, implementation_partner, end_client, status, technology, sub_technology, project_start_date, project_end_date, interview_date, interview_type, client_name, client_email, implementation_poc_email, interviewer_email, notes, employee_name, backup_employee_name, created_at, updated_at'
const CANDIDATE_FIELDS = 'Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology'

let _adminClient: ReturnType<typeof createAdminClient> | null = null
function getAdminClient() {
  if (_adminClient) return _adminClient
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (key) _adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _adminClient
}

const MAX_RECORDS = 2000

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
      lookupClient.from('Candidate_records').select('Candidate_name, technology').eq('backup_employee_id', ownerFilter),
    ])

    const ownedRecords = ownedResult.data || []
    const backupCandidates = backupCandidatesResult.data || []
    const backupNames = backupCandidates.map(c => c.Candidate_name)

    let backupRecords: any[] = []

    // 1) Match by Candidate_records backup_employee_id → candidate name → marketing_records name
    if (backupNames.length > 0) {
      const { data: br } = await lookupClient
        .from('marketing_records')
        .select(MARKETING_FIELDS)
        .in('name', backupNames)
        .order('created_at', { ascending: false })
        .limit(limitParam)
      backupRecords = br || []
    }

    // 2) Fallback: match by marketing_records.backup_employee_name (handles records synced without backup_employee_id)
    const [{ data: myProfile }, { data: myEmployee }] = await Promise.all([
      lookupClient.from('profiles').select('full_name').eq('id', ownerFilter).maybeSingle(),
      lookupClient.from('employees').select('full_name').eq('user_id', ownerFilter).maybeSingle(),
    ])
    const myName = myProfile?.full_name || myEmployee?.full_name
    if (myName) {
      const { data: nameBackupRecords } = await lookupClient
        .from('marketing_records')
        .select(MARKETING_FIELDS)
        .ilike('backup_employee_name', myName)
        .neq('owner_id', ownerFilter)
        .order('created_at', { ascending: false })
        .limit(limitParam)
      if (nameBackupRecords) {
        for (const r of nameBackupRecords) {
          if (!backupRecords.some(b => b.id === r.id)) backupRecords.push(r)
        }
      }
    }

    const recordMap = new Map<string, any>()
    for (const r of ownedRecords) recordMap.set(r.id, { ...r, is_backup_record: false })
    for (const r of backupRecords) {
      if (!recordMap.has(r.id)) recordMap.set(r.id, { ...r, is_backup_record: r.owner_id !== ownerFilter })
    }

    // Build set of name|technology keys where user is explicitly assigned as backup
    const bkKey = (s: string) => s.toLowerCase().trim()
    const backupTechKeys = new Set<string>()
    for (const c of backupCandidates) {
      backupTechKeys.add(bkKey(c.Candidate_name) + '|' + bkKey(c.technology || ''))
    }

    // Filter out backup records whose technology doesn't match the employee's backup assignment
    for (const [id, record] of recordMap) {
      if (record.owner_id !== ownerFilter) {
        const key = bkKey((record as any).name || '') + '|' + bkKey((record as any).technology || '')
        if (!backupTechKeys.has(key)) {
          recordMap.delete(id)
        }
      }
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
          const ilikeFilters = candidateNames.map(n => `Candidate_name.ilike.${n}`).join(',')
          const { data } = await lookupClient.from('Candidate_records').select(CANDIDATE_FIELDS).or(ilikeFilters)
          return { data: data || [] }
        })()
      : Promise.resolve({ data: [] }),
    lookupClient.from('marketing_reminder_logs').select('marketing_record_id, sent_at').is('error', null).in('marketing_record_id', data.map(r => r.id)).order('sent_at', { ascending: false }),
  ])

  const ownerNames = ownerNamesResult
  const candidatesData = candidatesResult.data || []
  const reminderLogs = reminderResult.data || []

  // Filter out records whose candidate status is Closed (by name+technology)
  const candidateStatusMap = new Map<string, string>()
  for (const c of candidatesData as any[]) {
    const key = ((c.Candidate_name || '') + '|' + (c.technology || '')).toLowerCase().trim()
    if (key && c.status) candidateStatusMap.set(key, c.status)
  }
  data = data.filter(r => {
    const key = ((r.name || '') + '|' + (r.technology || '')).toLowerCase().trim()
    const status = candidateStatusMap.get(key)
    return !status || status !== 'Closed'
  })
  if (data.length === 0) {
    return NextResponse.json({ records: [], timing: Date.now() - startTime })
  }

  // Note: Candidate_records should be created by the dedicated sync endpoints, not as a side effect of viewing records

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

  // Validate email fields
  const emailFields = ['recruiter_email', 'client_email', 'implementation_poc_email', 'interviewer_email']
  const isValidEmail = (v: string | null | undefined) => !v || /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v)
  for (const field of emailFields) {
    const val = recordData[field]
    if (val && !isValidEmail(val)) {
      return NextResponse.json({ error: `Invalid email format for ${field}` }, { status: 400 })
    }
  }

  // Normalize company name fields
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
  if (recordData.organization_name) recordData.organization_name = normalizeCompanyName(recordData.organization_name)
  if (recordData.implementation_partner) recordData.implementation_partner = normalizeCompanyName(recordData.implementation_partner)

  // Normalize candidate name: trim, collapse internal whitespace (case preserved for display)
  if (recordData.name) recordData.name = recordData.name.trim().replace(/\s+/g, ' ')

  // When creating a new record with candidate name + technology, auto-fill from Candidate_records
  if (!body.id && recordData.name) {
    const { data: candidates } = await supabase
      .from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name, technology')
      .ilike('Candidate_name', recordData.name)

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

  // ── Shared duplicate check ──────────────────────────────────────────────
  // Returns error response if a duplicate exists, or null if ok.
  // Applies normalizeCompanyName to company fields on both sides for fair comparison.
  async function checkDuplicate(candidateName: string, technology: string | null, excludeId?: string): Promise<NextResponse | null> {
    const adminClient = getAdminClient()
    if (!adminClient || !candidateName) return null
    const dupFields = ['recruiter_name', 'recruiter_email', 'organization_name', 'implementation_partner', 'end_client', 'client_name', 'client_email', 'implementation_poc_email', 'interviewer_email', 'notes', 'interview_type', 'project_start_date', 'project_end_date', 'interview_date']
    const norm = (v: any) => String(v ?? '').toLowerCase().trim()
    // Build normalized signature for the incoming record
    const makeSig = (obj: any) => dupFields.map((f: string) => {
      const raw = obj[f]
      // Normalize company-name fields before comparison
      if (f === 'organization_name' || f === 'implementation_partner') {
        return norm(normalizeCompanyName(raw) ?? raw)
      }
      return norm(raw)
    }).join('|||')
    const newSig = makeSig(recordData)
    const { data: existing } = await (adminClient as any)
      .from('marketing_records')
      .select('id, technology, ' + dupFields.join(', '))
      .ilike('name', candidateName)
    if (!existing) return null
    const techNorm = (v: any) => (v ?? '').toLowerCase().trim()
    const dup = (existing as any[]).find((r: any) => {
      if (excludeId && r.id === excludeId) return false
      if (techNorm(r.technology) !== techNorm(technology)) return false
      return makeSig(r) === newSig
    })
    if (dup) {
      return NextResponse.json({ error: 'Duplicate Profile' }, { status: 409 })
    }
    return null
  }

  if (body.id) {
    // --- EDITING EXISTING RECORD ---
      const { data: existingRecord } = await supabase
        .from('marketing_records')
        .select('owner_id, name, technology, backup_employee_name, date, date_locked')
        .eq('id', body.id)
        .single()

    if (!existingRecord) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    if (!isAdminUser && existingRecord.owner_id !== user.id) {
      const { data: candidate } = await supabase
        .from('Candidate_records')
        .select('id')
        .ilike('Candidate_name', existingRecord.name)
        .eq('backup_employee_id', user.id)
        .maybeSingle()

      if (!candidate) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Admin changing technology must pick one that exists in Candidate_records for this candidate
    if (isAdminUser && recordData.technology && existingRecord.name) {
      const { data: candidateTechs } = await supabase
        .from('Candidate_records')
        .select('technology')
        .ilike('Candidate_name', existingRecord.name)
      const validTechs = new Set((candidateTechs || []).map((c: any) => (c.technology || '').toLowerCase().trim()))
      if (!validTechs.has((recordData.technology || '').toLowerCase().trim())) {
        return NextResponse.json({ error: `Technology "${recordData.technology}" is not assigned to this candidate in Candidate Records` }, { status: 400 })
      }
    }

    // Dedup check on edit (exclude current record)
    const candidateName = recordData.name || existingRecord.name
    const techVal = recordData.technology !== undefined ? recordData.technology : existingRecord.technology
    const dupErr = await checkDuplicate(candidateName, techVal, body.id)
    if (dupErr) return dupErr

    let client = supabase
    if (!isAdminUser) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey) {
        const { createClient } = await import('@supabase/supabase-js')
        client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      }
    }

    const { employee_name: _, name, ...updatableFields } = recordData
    // Non-admin should not update employee meta fields
    if (!isAdminUser) {
      delete updatableFields.backup_employee_name
      delete updatableFields.technology
    }
    const updatePayload: any = { ...updatableFields, updated_at: new Date().toISOString() }
    // Normalize company name fields on edit
    if (updatePayload.organization_name) updatePayload.organization_name = normalizeCompanyName(updatePayload.organization_name)
    if (updatePayload.implementation_partner) updatePayload.implementation_partner = normalizeCompanyName(updatePayload.implementation_partner)

    // Date: editable only once
    if (existingRecord.date_locked) {
      delete updatePayload.date
    } else if (updatePayload.date !== undefined) {
      const submitted = updatePayload.date || null
      const current = existingRecord.date || null
      if (submitted !== current) {
        updatePayload.date_locked = true
      } else {
        delete updatePayload.date
      }
    }

    // Admin can edit employee_name on existing records — only when explicitly selecting an employee
    if (isAdminUser && selectedEmployeeId && employeeName) {
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

  // Dedup check on create
  if (insertData.name) {
    const dupErr = await checkDuplicate(insertData.name, insertData.technology)
    if (dupErr) return dupErr
  }

  const { data: inserted, error } = await supabase
    .from('marketing_records')
    .insert(insertData)
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
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()

  // Use admin client to bypass RLS
  const adminClient = getAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { error } = await (adminClient.from('marketing_records') as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient.from('audit_logs').insert([{
    action: 'deleted', entity_type: 'marketing_record', entity_id: id,
    user_id: user.id, created_at: new Date().toISOString(),
  }] as any)
  return NextResponse.json({ success: true })
}
