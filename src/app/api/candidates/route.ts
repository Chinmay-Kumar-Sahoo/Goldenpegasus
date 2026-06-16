import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CANDIDATE_FIELDS = 'id, Candidate_name, owner_id, backup_employee_id, backup_employee_name, status, technology, linkedin_url, Candidate_email, client_phone, address, notes, created_at, updated_at'
const PROFILE_FIELDS = 'id, full_name, email'

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
function getAdminClient() {
  if (_supabaseAdmin) return _supabaseAdmin
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (key) _supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _supabaseAdmin
}

const MAX_RECORDS = 2000

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ownerFilter = searchParams.get('owner_id')
  const limitParam = Math.min(Number(searchParams.get('limit')) || MAX_RECORDS, MAX_RECORDS)

  const supabaseAdmin = getAdminClient()
  const adminClient = supabaseAdmin
  const lookupClient = adminClient || supabase

  let records: any[] = []
  if (ownerFilter) {
    const baseQuery = () => lookupClient.from('Candidate_records').select(CANDIDATE_FIELDS).order('created_at', { ascending: false }).limit(limitParam)
    const [ownedResult, backupResult] = await Promise.all([
      baseQuery().eq('owner_id', ownerFilter),
      baseQuery().eq('backup_employee_id', ownerFilter),
    ])
    if (ownedResult.error) return NextResponse.json({ error: ownedResult.error.message }, { status: 500 })
    if (backupResult.error) return NextResponse.json({ error: backupResult.error.message }, { status: 500 })
    const recordMap = new Map<string, any>()
    for (const r of (ownedResult.data || [])) recordMap.set(r.id, r)
    for (const r of (backupResult.data || [])) if (!recordMap.has(r.id)) recordMap.set(r.id, r)
    records = Array.from(recordMap.values())
  } else {
    const { data, error } = await lookupClient
      .from('Candidate_records')
      .select(CANDIDATE_FIELDS)
      .order('created_at', { ascending: false })
      .limit(limitParam)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    records = data || []
  }

  // Deduplicate by (Candidate_name, technology) — keep original (oldest) record per unique combination
  {
    const dedupMap = new Map<string, any>()
    for (const r of records) {
      const key = ((r.Candidate_name || '') + '|' + (r.technology || '')).toLowerCase().trim()
      if (!key) { dedupMap.set(r.id, r); continue }
      const existing = dedupMap.get(key)
      if (!existing || (r.created_at || '') < (existing.created_at || '')) {
        dedupMap.set(key, r)
      }
    }
    records = Array.from(dedupMap.values())
  }

  // Note: Candidate_records backfill from marketing_records happens in server-rendered page components,
  // not as a side effect of this GET endpoint, to avoid data mutation on read requests.

  if (records.length === 0) {
    return NextResponse.json({ records: [], timing: 0 })
  }

  const allIds = Array.from(new Set([
    ...records.map(r => r.owner_id).filter(Boolean),
    ...records.map(r => r.backup_employee_id as string | undefined).filter(Boolean),
  ]))

  let ownerNames: Record<string, string> = {}
  if (allIds.length > 0) {
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      lookupClient.from('profiles').select(PROFILE_FIELDS).in('id', allIds),
      lookupClient.from('employees').select('user_id, full_name, email').in('user_id', allIds),
    ])
    for (const p of (profiles || [])) if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
    for (const e of (employees || [])) if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
  }

  const enriched = records.map(r => ({
    ...r,
    employee_name: r.owner_id ? (ownerNames[r.owner_id] || null) : null,
    backup_employee_name: r.backup_employee_name || (r.backup_employee_id ? (ownerNames[r.backup_employee_id] || null) : null),
  }))

  return NextResponse.json({ records: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdminUser = profile?.role === 'admin'

  const body = await req.json()
  const { selectedEmployeeId, backupEmployeeId, employee_name, ...recordData } = body

  let effectiveOwnerId = user.id
  if (selectedEmployeeId) {
    effectiveOwnerId = selectedEmployeeId
  }

  let backupName: string | null = null
  if (backupEmployeeId) {
    const [profileResult, employeeResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', backupEmployeeId).single(),
      supabase.from('employees').select('full_name').eq('user_id', backupEmployeeId).single(),
    ])
    if (profileResult.data?.full_name) backupName = profileResult.data.full_name
    if (employeeResult.data?.full_name) backupName = employeeResult.data.full_name
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (recordData.Candidate_email && !emailRe.test(recordData.Candidate_email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }
  if (recordData.client_phone) {
    recordData.client_phone = String(recordData.client_phone).replace(/\D/g, '')
    if (recordData.client_phone.length !== 10) {
      return NextResponse.json({ error: 'Phone must be exactly 10 digits' }, { status: 400 })
    }
  }

  if (body.id) {
    const updateData: any = { ...recordData, updated_at: new Date().toISOString() }
    if (selectedEmployeeId) updateData.owner_id = selectedEmployeeId
    if (backupEmployeeId !== undefined) updateData.backup_employee_id = backupEmployeeId || null
    if (backupName !== null) updateData.backup_employee_name = backupName

    const { error } = await supabase
      .from('Candidate_records')
      .update(updateData)
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get candidate name for syncing marketing records
    const { data: candidate } = await supabase
      .from('Candidate_records')
      .select('Candidate_name, owner_id')
      .eq('id', body.id)
      .single()

    if (candidate?.Candidate_name) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
      const supabaseAdmin = serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : null

      // Sync owner_id change to all related marketing records (match by name + technology)
      if (selectedEmployeeId) {
        const [pResult, eResult] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId).maybeSingle(),
          supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId).maybeSingle(),
        ])
        const empName = pResult.data?.full_name || eResult.data?.full_name || ''

        const client = supabaseAdmin || supabase
        const mktQ = client.from('marketing_records').update({ owner_id: selectedEmployeeId, employee_name: empName || null, updated_at: new Date().toISOString() }).eq('name', candidate.Candidate_name)
        if (recordData.technology) {
          await mktQ.eq('technology', recordData.technology)
        } else {
          await mktQ.is('technology', null)
        }
      }

      // Sync backup_employee change to related marketing records (match by name + technology)
      if (backupEmployeeId !== undefined) {
        const client = supabaseAdmin || supabase
        const mktQ = client.from('marketing_records').update({ backup_employee_name: backupName, updated_at: new Date().toISOString() }).eq('name', candidate.Candidate_name)
        if (recordData.technology) {
          await mktQ.eq('technology', recordData.technology)
        } else {
          await mktQ.is('technology', null)
        }
      }
    }

    // Sync updated fields to matching marketing_records
    if (recordData.Candidate_name) {
      const adminClient = getAdminClient()
      if (adminClient) {
        const mktTech = (recordData.technology || '').toLowerCase().trim()
        const { data: existingMktRows } = await (adminClient.from('marketing_records') as any)
          .select('id, technology')
          .ilike('name', recordData.Candidate_name) as any
        const existingMkt = (existingMktRows || []).find((m: any) => (m.technology || '').toLowerCase().trim() === mktTech) || null
        const mktPayload: any = { updated_at: new Date().toISOString() }
        if (recordData.status !== undefined) mktPayload.status = recordData.status
        if (recordData.notes !== undefined) mktPayload.notes = recordData.notes
        if (recordData.technology !== undefined) mktPayload.technology = recordData.technology
        if (selectedEmployeeId) mktPayload.owner_id = selectedEmployeeId
        if (backupEmployeeId !== undefined) mktPayload.backup_employee_id = backupEmployeeId || null
        if (backupName !== null) mktPayload.backup_employee_name = backupName
        const [pResult, eResult] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId || effectiveOwnerId).maybeSingle(),
          supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId || effectiveOwnerId).maybeSingle(),
        ])
        const empName = pResult.data?.full_name || eResult.data?.full_name || null
        if (empName) mktPayload.employee_name = empName
        if (existingMkt) {
          await (adminClient.from('marketing_records') as any).update(mktPayload).eq('id', existingMkt.id)
        } else {
          mktPayload.name = recordData.Candidate_name
          mktPayload.date = new Date().toISOString().split('T')[0]
          await (adminClient.from('marketing_records') as any).insert(mktPayload)
        }
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'updated', entity_type: 'candidate_record', entity_id: body.id,
      user_id: user.id, created_at: new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  }

  const insertData: any = { ...recordData, owner_id: effectiveOwnerId }
  if (backupEmployeeId) {
    insertData.backup_employee_id = backupEmployeeId
    if (backupName) insertData.backup_employee_name = backupName
  }

  // --- Dedup: skip if candidate with same name + technology already exists (use admin client to bypass RLS) ---
  if (insertData.Candidate_name) {
    const adminClient = getAdminClient()
    if (adminClient) {
      const techValue = (insertData.technology || '').toLowerCase().trim()
      const { data: existingCands } = await (adminClient as any)
        .from('Candidate_records')
        .select('id, technology')
        .ilike('Candidate_name', insertData.Candidate_name)
      const isDuplicate = (existingCands || []).some((r: any) => (r.technology || '').toLowerCase().trim() === techValue)
      if (isDuplicate) {
        return NextResponse.json({ error: 'Duplicate Profile' }, { status: 409 })
      }
    }
  }

  const { data: inserted, error } = await supabase
    .from('Candidate_records')
    .insert(insertData)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync to marketing_records
  const adminClient = getAdminClient()
  if (adminClient && recordData.Candidate_name) {
    const mktTech = (recordData.technology || '').toLowerCase().trim()
    const { data: existingMktRows } = await (adminClient.from('marketing_records') as any)
      .select('id, technology')
      .ilike('name', recordData.Candidate_name) as any
    const existingMkt = (existingMktRows || []).find((m: any) => (m.technology || '').toLowerCase().trim() === mktTech) || null
    const mktPayload: any = {
      name: recordData.Candidate_name,
      technology: recordData.technology || null,
      status: recordData.status || null,
      notes: recordData.notes || null,
      owner_id: effectiveOwnerId,
      employee_name: (employee_name || null),
      updated_at: new Date().toISOString(),
    }
    if (backupEmployeeId !== undefined) mktPayload.backup_employee_id = backupEmployeeId || null
    if (backupName !== null) mktPayload.backup_employee_name = backupName
    if (existingMkt) {
      await (adminClient.from('marketing_records') as any).update(mktPayload).eq('id', existingMkt.id)
    } else {
      mktPayload.date = new Date().toISOString().split('T')[0]
      await (adminClient.from('marketing_records') as any).insert(mktPayload)
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'created', entity_type: 'candidate_record', entity_id: inserted?.id || '',
    user_id: user.id, created_at: new Date().toISOString(),
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()

  // Fetch candidate name before deleting, for sync
  const { data: candidate } = await supabase.from('Candidate_records').select('Candidate_name').eq('id', id).single()

  const { error } = await supabase.from('Candidate_records').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also delete from marketing_records if no other Candidate_records reference this candidate
  if (candidate?.Candidate_name) {
    const adminClient = getAdminClient()
    if (adminClient) {
      const { data: remaining } = await (adminClient.from('Candidate_records') as any).select('id').ilike('Candidate_name', candidate.Candidate_name).limit(1)
      if (!remaining || remaining.length === 0) {
        await (adminClient.from('marketing_records') as any).delete().ilike('name', candidate.Candidate_name)
      }
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'deleted', entity_type: 'candidate_record', entity_id: id,
    user_id: user.id, created_at: new Date().toISOString(),
  })
  return NextResponse.json({ success: true })
}
