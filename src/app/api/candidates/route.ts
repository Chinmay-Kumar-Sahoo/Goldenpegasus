import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ownerFilter = searchParams.get('owner_id')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null
  const lookupClient = supabaseAdmin || supabase

  let records: any[] = []
  if (ownerFilter) {
    const ownedQuery = supabase.from('Candidate_records').select('*').eq('owner_id', ownerFilter).order('created_at', { ascending: false })
    const backupQuery = supabaseAdmin
      ? supabaseAdmin.from('Candidate_records').select('*').eq('backup_employee_id', ownerFilter).order('created_at', { ascending: false })
      : supabase.from('Candidate_records').select('*').eq('backup_employee_id', ownerFilter).order('created_at', { ascending: false })

    const [ownedResult, backupResult] = await Promise.all([ownedQuery, backupQuery])
    if (ownedResult.error) return NextResponse.json({ error: ownedResult.error.message }, { status: 500 })
    if (backupResult.error) return NextResponse.json({ error: backupResult.error.message }, { status: 500 })
    const recordMap = new Map<string, any>()
    for (const r of (ownedResult.data || [])) recordMap.set(r.id, r)
    for (const r of (backupResult.data || [])) {
      if (!recordMap.has(r.id)) recordMap.set(r.id, r)
    }
    records = Array.from(recordMap.values())
  } else {
    const { data, error } = await lookupClient
      .from('Candidate_records')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    records = data || []
  }

  if (records.length === 0) {
    return NextResponse.json({ records: [] })
  }

  const ownerIds = Array.from(new Set(records.map(r => r.owner_id).filter(Boolean)))
  const backupIds = Array.from(new Set(records.map(r => (r as any).backup_employee_id).filter(Boolean)))
  const allIds = Array.from(new Set([...ownerIds, ...backupIds]))

  const [{ data: profiles }, { data: employees }] = await Promise.all([
    lookupClient.from('profiles').select('id, full_name, email').in('id', allIds.length > 0 ? allIds : ['']),
    lookupClient.from('employees').select('user_id, full_name, email').in('user_id', allIds.length > 0 ? allIds : ['']),
  ])

  const ownerNames: Record<string, string> = {}
  for (const p of (profiles || [])) if (p.id) ownerNames[p.id] = p.full_name || p.email || 'Unknown employee'
  for (const e of (employees || [])) if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'

  const enriched = records.map(r => ({
    ...r,
    employee_name: ownerNames[r.owner_id] || null,
    backup_employee_name: (r as any).backup_employee_name || ((r as any).backup_employee_id ? ownerNames[(r as any).backup_employee_id] : null) || null,
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

      // Sync owner_id change to all related marketing records
      if (selectedEmployeeId) {
        const [pResult, eResult] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', selectedEmployeeId).maybeSingle(),
          supabase.from('employees').select('full_name').eq('user_id', selectedEmployeeId).maybeSingle(),
        ])
        const empName = pResult.data?.full_name || eResult.data?.full_name || ''

        const client = supabaseAdmin || supabase
        await client
          .from('marketing_records')
          .update({ owner_id: selectedEmployeeId, employee_name: empName || null, updated_at: new Date().toISOString() })
          .eq('name', candidate.Candidate_name)
      }

      // Sync backup_employee change to related marketing records
      if (backupEmployeeId !== undefined) {
        const client = supabaseAdmin || supabase
        await client
          .from('marketing_records')
          .update({
            backup_employee_name: backupName,
            updated_at: new Date().toISOString(),
          })
          .eq('name', candidate.Candidate_name)
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

  const { data: inserted, error } = await supabase
    .from('Candidate_records')
    .insert(insertData)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
  const { error } = await supabase.from('Candidate_records').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert({
    action: 'deleted', entity_type: 'candidate_record', entity_id: id,
    user_id: user.id, created_at: new Date().toISOString(),
  })
  return NextResponse.json({ success: true })
}
