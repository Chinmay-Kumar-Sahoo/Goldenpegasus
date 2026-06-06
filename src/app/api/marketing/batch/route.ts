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

  // Gather unique candidate names, technologies, and employee names from the import
  const rawCandidateNames = [...new Set(records.map((r: any) => (r.name || '').trim()).filter(Boolean))] as string[]
  const technologies = [...new Set(records.map((r: any) => r.technology).filter(Boolean))] as string[]
  const primaryNames = [...new Set(records.map((r: any) => (r.employee_name || '').trim()).filter(Boolean))] as string[]

  // Fetch Candidate_records with both name and technology (exact match first)
  let candidatesData: any[] = []
  if (rawCandidateNames.length > 0) {
    const client = supabaseAdmin || supabase
    const { data } = await client
      .from('Candidate_records')
      .select('Candidate_name, technology, owner_id, backup_employee_id, backup_employee_name, status')
      .in('Candidate_name', rawCandidateNames)
    candidatesData = data || []

    // Fallback: case-insensitive matching for candidate names not found by exact match
    const foundCandidateNames = new Set(candidatesData.map(c => normalize(c.Candidate_name)))
    const unmatchedCandidates = rawCandidateNames.filter(n => !foundCandidateNames.has(normalize(n)))
    for (const cName of unmatchedCandidates) {
      const client = supabaseAdmin || supabase
      const { data: fallback } = await client
        .from('Candidate_records')
        .select('Candidate_name, technology, owner_id, backup_employee_id, backup_employee_name, status')
        .ilike('Candidate_name', cName)
      if (fallback) {
        candidatesData = [...candidatesData, ...fallback]
      }
    }
  }

  // If employee, restrict to only candidates they are assigned to
  if (!isAdmin) {
    candidatesData = candidatesData.filter((c: any) =>
      c.owner_id === user.id || c.backup_employee_id === user.id
    )
  }

  // Fetch profiles and employees to resolve names (exact match first)
  const lookupClient = supabaseAdmin || supabase
  const [profilesResult, employeesResult] = await Promise.all([
    lookupClient.from('profiles').select('id, full_name').in('full_name', primaryNames.length > 0 ? primaryNames : ['']),
    lookupClient.from('employees').select('user_id, full_name').in('full_name', primaryNames.length > 0 ? primaryNames : ['']),
  ])

  // Build employee name-to-ID map from exact matches
  const primaryEmployeeMap = new Map<string, string>()
  const employeeIdToName = new Map<string, string>()
  const profilesData = profilesResult.data || []
  const employeesData = employeesResult.data || []

  for (const p of profilesData) {
    if (p.full_name) { primaryEmployeeMap.set(normalize(p.full_name), p.id); employeeIdToName.set(p.id, p.full_name) }
  }
  for (const e of employeesData) {
    if (e.full_name) { primaryEmployeeMap.set(normalize(e.full_name), e.user_id); if (e.user_id && !employeeIdToName.has(e.user_id)) employeeIdToName.set(e.user_id, e.full_name) }
  }

  // Fallback: case-insensitive matching for names not found by exact match
  if (primaryNames.length > 0) {
    const foundNames = new Set([
      ...profilesData.map(p => normalize(p.full_name || '')),
      ...employeesData.map(e => normalize(e.full_name || '')),
    ].filter(Boolean))
    const unmatched = primaryNames.filter(n => !foundNames.has(normalize(n)))
    for (const name of unmatched) {
      const [{ data: mp }, { data: me }] = await Promise.all([
        lookupClient.from('profiles').select('id, full_name').ilike('full_name', `%${name}%`),
        lookupClient.from('employees').select('user_id, full_name').ilike('full_name', `%${name}%`),
      ])
      for (const p of (mp || [])) {
        if (p.full_name && !primaryEmployeeMap.has(normalize(p.full_name))) {
          primaryEmployeeMap.set(normalize(p.full_name), p.id)
          if (!employeeIdToName.has(p.id)) employeeIdToName.set(p.id, p.full_name)
        }
      }
      for (const e of (me || [])) {
        if (e.full_name && !primaryEmployeeMap.has(normalize(e.full_name))) {
          primaryEmployeeMap.set(normalize(e.full_name), e.user_id)
          if (e.user_id && !employeeIdToName.has(e.user_id)) employeeIdToName.set(e.user_id, e.full_name)
        }
      }
    }
  }

  // Resolve names for IDs found in Candidate_records
  const allCandIds = [...new Set([
    ...candidatesData.map((c: any) => c.owner_id).filter(Boolean),
    ...candidatesData.map((c: any) => c.backup_employee_id).filter(Boolean),
  ])] as string[]
  const idToName = new Map<string, string>()
  if (allCandIds.length > 0) {
    const [{ data: bp }, { data: be }] = await Promise.all([
      (supabaseAdmin || supabase).from('profiles').select('id, full_name').in('id', allCandIds),
      (supabaseAdmin || supabase).from('employees').select('user_id, full_name').in('user_id', allCandIds),
    ])
    for (const p of (bp || [])) if (p.full_name) idToName.set(p.id, p.full_name)
    for (const e of (be || [])) if (e.full_name) idToName.set(e.user_id, e.full_name)
  }

  // Build candidate lookup keys: "name|tech" -> candidate record
  const candidateLookup = new Map<string, any>()
  for (const c of candidatesData) {
    const key = normalize(c.Candidate_name) + '|' + (c.technology ? normalize(c.technology) : '')
    if (!candidateLookup.has(key)) {
      candidateLookup.set(key, c)
    }
    // Also store under name-only key for fallback
    const nameKey = normalize(c.Candidate_name) + '|'
    if (!candidateLookup.has(nameKey)) {
      candidateLookup.set(nameKey, c)
    }
  }

  const now = new Date().toISOString()
  const validRecords: any[] = []
  const errors: { name: string; issues: string[] }[] = []
  let hasCriticalError = false

  for (const r of records) {
    const issues: string[] = []
    const name = r.name || ''
    const tech = r.technology || ''
    const empName = r.employee_name

    // --- Step 1: Find candidate by name (case-insensitive) ---
    const candidatesWithName = candidatesData.filter((c: any) => normalize(c.Candidate_name) === normalize(name))

    if (candidatesWithName.length === 0) {
      issues.push(`Candidate "${name}" not found in All Candidates Records`)
      hasCriticalError = true
      errors.push({ name, issues })
      continue
    }

    // --- Step 2: Check Technology match ---
    let candidateInfo: any = null
    if (tech) {
      // Excel specified a technology — must match candidate's technology
      candidateInfo = candidatesWithName.find((c: any) => c.technology && normalize(c.technology) === normalize(tech)) || null
      if (!candidateInfo) {
        const existingTechs = [...new Set(candidatesWithName.map((c: any) => c.technology).filter(Boolean))]
        const errorMsg = existingTechs.length > 0
          ? `Technology mismatch for "${name}" — Candidate has ${existingTechs.map(t => `"${t}"`).join(', ')} but Excel specifies "${tech}"`
          : `Technology mismatch for "${name}" — Candidate has no technology but Excel specifies "${tech}"`
        issues.push(errorMsg)
        hasCriticalError = true
        errors.push({ name, issues })
        continue
      }
    } else {
      // Excel didn't specify technology — accept any match by name
      candidateInfo = candidatesWithName[0]
    }

    // --- Step 3: Resolve primary employee ---
    let primaryUserId: string | null = null
    let primaryUserName: string | null = null

    if (empName) {
      primaryUserId = primaryEmployeeMap.get(normalize(empName)) || null
      if (!primaryUserId) {
        // Try partial match: find any employee whose full name contains the provided name
        const norm = normalize(empName)
        for (const [key, id] of primaryEmployeeMap) {
          if (key.includes(norm)) {
            primaryUserId = id
            primaryUserName = employeeIdToName.get(id) || empName
            break
          }
        }
      }
      if (!primaryUserId) {
        issues.push(`Employee "${empName}" not found in system`)
        hasCriticalError = true
        errors.push({ name: r.name || '', issues })
        continue
      }
      if (!primaryUserName) primaryUserName = empName
    }

    // --- Step 4: Check if employee matches candidate record's primary employee ---
    if (candidateInfo.owner_id && primaryUserId) {
      if (primaryUserId !== candidateInfo.owner_id) {
        const actualOwnerName = idToName.get(candidateInfo.owner_id) || ''
        issues.push(`Employee mismatch for "${name}" — Candidate already assigned to "${actualOwnerName}" but Excel specifies "${empName}"`)
        hasCriticalError = true
        errors.push({ name: r.name || '', issues })
        continue
      }
    }

    // --- Step 5: Fetch Backup Employee from Candidate_records ---
    let backupEmployeeName = r.backup_employee_name || ''
    if (!backupEmployeeName && candidateInfo.backup_employee_name) {
      backupEmployeeName = candidateInfo.backup_employee_name
    }
    if (!backupEmployeeName && candidateInfo.backup_employee_id && idToName.has(candidateInfo.backup_employee_id)) {
      backupEmployeeName = idToName.get(candidateInfo.backup_employee_id) || ''
    }

    r._owner_id = primaryUserId || candidateInfo.owner_id || user.id
    r._employee_name = primaryUserName || idToName.get(r._owner_id) || r.employee_name || null
    r._backup_employee_name = backupEmployeeName || null
    validRecords.push(r)
  }

  // If any critical errors, reject entire batch
  if (hasCriticalError) {
    return NextResponse.json({
      error: 'Import validation failed. No records were imported.',
      errors,
      imported: 0,
      total: records.length,
    }, { status: 400 })
  }

  const insertedList: Array<{ id: string; name: string; owner_id: string }> = []
  if (validRecords.length > 0) {
    const insertRecords = validRecords.map((r: any) => ({
      name: r.name,
      date: isValidISODate(r.date) ? r.date : null,
      status: r.status || 'Telephone Call',
      recruiter_name: r.recruiter_name || null,
      recruiter_email: r.recruiter_email || null,
      organization_name: r.organization_name || null,
      implementation_partner: r.implementation_partner || null,
      end_client: r.end_client || null,
      technology: r.technology || null,
      project_start_date: isValidISODate(r.project_start_date) ? r.project_start_date : null,
      project_end_date: isValidISODate(r.project_end_date) ? r.project_end_date : null,
      interview_date: isValidISODate(r.interview_date) ? r.interview_date : null,
      interview_type: r.interview_type || null,
      client_name: r.client_name || null,
      client_email: r.client_email || null,
      implementation_poc_email: r.implementation_poc_email || null,
      interviewer_email: r.interviewer_email || null,
      notes: r.notes || null,
      employee_name: r._employee_name || null,
      backup_employee_name: r._backup_employee_name || null,
      owner_id: r._owner_id || user.id,
      created_at: now,
      updated_at: now,
    }))

    const { data: inserted, error } = await supabase
      .from('marketing_records')
      .insert(insertRecords)
      .select('id, name, owner_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const item of (inserted || [])) insertedList.push(item)

    // --- Update Candidate_records with backup owner info ---
    if (supabaseAdmin) {
      const candidateUpdates = new Map<string, { backupName?: string }>()
      for (const r of validRecords) {
        if (r._backup_employee_name && r.name) {
          const existing = candidateUpdates.get(normalize(r.name)) || {}
          if (r._backup_employee_name) existing.backupName = r._backup_employee_name
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
