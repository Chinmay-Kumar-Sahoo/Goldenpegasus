import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = profile?.role === 'admin'

  const { ids, updates } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No records specified' }, { status: 400 })
  }

  let allowedUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (isAdmin) {
    Object.assign(allowedUpdates, updates)
  } else {
    if (updates.address !== undefined) allowedUpdates.address = updates.address
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  const updateClient = serviceRoleKey
    ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase

  const { error } = await updateClient.from('Candidate_records').update(allowedUpdates).in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert(ids.map(id => ({ action: 'batch_updated', entity_type: 'candidate_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })))

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No records specified' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    const deleteClient = serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase

    // Fetch (Candidate_name, technology) for the given IDs
    const { data: toDelete } = await deleteClient.from('Candidate_records').select('Candidate_name, technology').in('id', ids)
    if (!toDelete || toDelete.length === 0) {
      return NextResponse.json({ error: 'No matching records found' }, { status: 404 })
    }

    // Delete ALL records matching those (name, technology) combos (covers dedup duplicates)
    const conditions = toDelete.map((r: any) => ({
      name: r.Candidate_name,
      tech: r.technology || '',
    }))
    // Use OR filter: for each combo, ilike name + exact tech match
    for (const c of conditions) {
      const { error } = await deleteClient.from('Candidate_records').delete()
        .ilike('Candidate_name', c.name)
        .eq('technology', c.tech === '' ? null : c.tech)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('audit_logs').insert(toDelete.map((r: any) => ({
      action: 'batch_deleted', entity_type: 'candidate_record',
      entity_id: r.Candidate_name + '|' + (r.technology || ''),
      user_id: user.id, created_at: new Date().toISOString(),
    })))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
