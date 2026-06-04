import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ownerFilter = searchParams.get('owner_id')

  let query = supabase.from('marketing_records').select('*')
  if (ownerFilter) query = query.eq('owner_id', ownerFilter)
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const records = data || []
  const ownerIds = Array.from(new Set(records.map(r => r.owner_id).filter(Boolean)))
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

  let lastReminderByRecord: Record<string, string> = {}
  if (records.length > 0) {
    const { data: reminderLogs } = await supabase
      .from('marketing_reminder_logs')
      .select('marketing_record_id, sent_at')
      .is('error', null)
      .in('marketing_record_id', records.map(r => r.id))
      .order('sent_at', { ascending: false })
    for (const log of (reminderLogs || []) as any[]) {
      if (!lastReminderByRecord[log.marketing_record_id]) {
        lastReminderByRecord[log.marketing_record_id] = log.sent_at
      }
    }
  }

  const enriched = records.map(r => ({
    ...r,
    employee_name: (r as any).employee_name || ownerNames[r.owner_id] || 'Unknown employee',
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
    const { error } = await supabase
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
