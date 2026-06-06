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

  const normalize = (s: string) => s.toLowerCase().trim()
  const denormalize = (s: string) => s.trim()

  const isValidISODate = (s: string | null) => {
    if (!s) return true
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime())
  }

  // Gather unique candidate names and employee names from the import
  const candidateNames = [...new Set(records.map((r: any) => r.name).filter(Boolean))] as string[]
  const primaryNames = [...new Set(records.map((r: any) => r.employee_name).filter(Boolean))] as string[]

  // Fetch existing data: Candidate_records (full), profiles, employees
  const [candidatesResult, profilesResult, employeesResult] = await Promise.all([
    (supabaseAdmin || supabase)
      .from('Candidate_records')
      .select('Candidate_name, owner_id, backup_employee_id, backup_employee_name')
      .in('Candidate_name', candidateNames.length > 0 ? candidateNames : ['']),
    supabase.from('profiles').select('id, full_name').in('full_name', primaryNames.length > 0 ? primaryNames : ['']),
    supabase.from('employees').select('user_id, full_name').in('full_name', primaryNames.length > 0 ? primaryNames : ['']),
  ])

  // Build candidate info map (from Candidate_records)
  const candidateInfoMap = new Map<string, { owner_id?: string; backup_employee_id?: string; backup_employee_name?: string; Candidate_name: string }>()
  for (const c of (candidatesResult.data || [])) {
    if (c.Candidate_name) candidateInfoMap.set(normalize(c.Candidate_name), c)
  }

  // Resolve names for IDs found in Candidate_records
  const allCandIds = [...new Set([
    ...(candidatesResult.data || []).map((c: any) => c.owner_id).filter(Boolean),
    ...(candidatesResult.data || []).map((c: any) => c.backup_employee_id).filter(Boolean),
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

  // Build employee name-to-ID map (from the import's employee_name column)
  const primaryEmployeeMap = new Map<string, string>()
  const employeeIdToName = new Map<string, string>()
  for (const p of (profilesResult.data || [])) {
    if (p.full_name) { primaryEmployeeMap.set(normalize(p.full_name), p.id); employeeIdToName.set(p.id, p.full_name) }
  }
  for (const e of (employeesResult.data || [])) {
    if (e.full_name) { primaryEmployeeMap.set(normalize(e.full_name), e.user_id); if (e.user_id && !employeeIdToName.has(e.user_id)) employeeIdToName.set(e.user_id, e.full_name) }
  }

  const now = new Date().toISOString()
  const validRecords: any[] = []
  const errors: { name: string; issues: string[] }[] = []

  for (const r of records) {
    const issues: string[] = []
    const candidateInfo = r.name ? candidateInfoMap.get(normalize(r.name)) : null

    // --- Resolve primary employee ---
    let primaryUserId: string | null = null
    const empName = r.employee_name

    if (empName) {
      // 1) Try direct name lookup
      primaryUserId = primaryEmployeeMap.get(normalize(empName)) || null
      if (!primaryUserId) {
        // 2) Employee name from Excel not found — fall back to Candidate_records owner
        primaryUserId = candidateInfo?.owner_id || null
        if (!primaryUserId) {
          // 3) Last resort — assign to the importing admin
          primaryUserId = user.id
          issues.push('Primary Employee Not Found — assigned to Admin')
        } else {
          issues.push('Employee name mismatch — using Candidate_records owner')
        }
      }
    } else {
      // No employee_name in Excel — use Candidate_records owner or admin
      primaryUserId = candidateInfo?.owner_id || user.id
      if (!candidateInfo?.owner_id) issues.push('No employee specified — assigned to Admin')
    }

    // --- Resolve backup employee name (if not in Excel, pull from Candidate_records) ---
    if (!r.backup_employee_name && candidateInfo?.backup_employee_name) {
      r.backup_employee_name = candidateInfo.backup_employee_name
    }
    if (!r.backup_employee_name && candidateInfo?.backup_employee_id && idToName.has(candidateInfo.backup_employee_id)) {
      r.backup_employee_name = idToName.get(candidateInfo.backup_employee_id)
    }

    // Track reconciliation: does the assigned owner differ from what Candidate_records expects?
    const needsReconcile = candidateInfo?.owner_id && candidateInfo.owner_id !== primaryUserId

    r._owner_id = primaryUserId
    r._candidateExists = !!candidateInfo
    r._needsReconcile = !!needsReconcile
    r._candidateActualName = candidateInfo?.Candidate_name || r.name
    validRecords.push(r)
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
      project_start_date: isValidISODate(r.project_start_date) ? r.project_start_date : null,
      project_end_date: isValidISODate(r.project_end_date) ? r.project_end_date : null,
      interview_date: isValidISODate(r.interview_date) ? r.interview_date : null,
      interview_type: r.interview_type || null,
      client_name: r.client_name || null,
      client_email: r.client_email || null,
      implementation_poc_email: r.implementation_poc_email || null,
      interviewer_email: r.interviewer_email || null,
      notes: r.notes || null,
      employee_name: r._needsReconcile ? 'Admin' : (employeeIdToName.get(r._owner_id) || r.employee_name || null),
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

    // --- Update Candidate_records with owner / backup info ---
    if (supabaseAdmin) {
      const candidateUpdates = new Map<string, { primaryUserId?: string; backupName?: string }>()
      for (const r of validRecords) {
        if (r._candidateExists && r.name) {
          const existing = candidateUpdates.get(r._candidateActualName) || {}
          if (r._owner_id) existing.primaryUserId = r._owner_id
          const backupName = r.backup_employee_name
          if (backupName) existing.backupName = backupName
          candidateUpdates.set(r._candidateActualName, existing)
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
          if (update.primaryUserId) candidatePayload.owner_id = update.primaryUserId
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

    // --- Post-import reconciliation: fix records where owner mismatches Candidate_records ---
    const reconcileRecords = validRecords.filter((r: any) => r._needsReconcile)
    if (reconcileRecords.length > 0) {
      const reconcileNames = reconcileRecords.map((r: any) => r.name).filter(Boolean) as string[]
      // Find the inserted IDs for these names
      const insertedByName = new Map<string, string[]>()
      for (const item of insertedList) {
        if (item.name) {
          const existing = insertedByName.get(normalize(item.name)) || []
          existing.push(item.id)
          insertedByName.set(normalize(item.name), existing)
        }
      }
      const idsToReconcile: string[] = []
      for (const r of reconcileRecords) {
        const ids = r.name ? insertedByName.get(normalize(r.name)) : undefined
        if (ids) idsToReconcile.push(...ids)
      }
      if (idsToReconcile.length > 0) {
        // Set employee_name to 'Admin' and clear any backup references
        await supabase
          .from('marketing_records')
          .update({ employee_name: 'Admin', updated_at: now })
          .in('id', idsToReconcile)
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
