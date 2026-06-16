import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ids, updates } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No records specified' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const deleteClient = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase

  const updatePayload: Record<string, any> = {}
  for (const key of Object.keys(updates)) {
    if (updates[key] !== '' && updates[key] !== undefined) updatePayload[key] = updates[key]
  }
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Fetch existing records, update their data field
  const { data: existing } = await deleteClient.from('dynamic_table_records').select('id, data').in('id', ids)
  if (!existing) return NextResponse.json({ error: 'Records not found' }, { status: 404 })

  const now = new Date().toISOString()
  const BATCH_SIZE = 50
  for (let i = 0; i < existing.length; i += BATCH_SIZE) {
    const batch = existing.slice(i, i + BATCH_SIZE)
    for (const rec of batch) {
      const newData = { ...(rec.data || {}), ...updatePayload }
      const { error: updateErr } = await deleteClient.from('dynamic_table_records').update({ data: newData, updated_at: now }).eq('id', rec.id)
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = ids.filter(id => typeof id !== 'string' || !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: `Invalid record ID format: ${JSON.stringify(invalidIds.slice(0, 3))}${invalidIds.length > 3 ? `... (${invalidIds.length} total)` : ''}` }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    const deleteClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase

    const BATCH_SIZE = 50
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)
      const { error: delError } = await deleteClient.from('dynamic_table_records').delete().in('id', batch)
      if (delError) return NextResponse.json({ error: `Delete failed at batch ${i / BATCH_SIZE + 1}: ${delError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: `Unexpected error: ${err.message}` }, { status: 500 })
  }
}
