import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
