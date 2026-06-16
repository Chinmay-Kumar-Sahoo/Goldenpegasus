import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (key) return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, updates } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No records specified' }, { status: 400 })
  }

  const { error } = await supabase.from('Candidate_records').update({ ...updates, updated_at: new Date().toISOString() }).in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync updates to matching marketing_records
  if (updates && Object.keys(updates).length > 0) {
    const adminClient = getAdminClient()
    if (adminClient) {
      const { data: candidates } = await adminClient.from('Candidate_records').select('Candidate_name').in('id', ids)
      if (candidates) {
        for (const c of candidates) {
          if (c.Candidate_name) {
            const mktPayload: any = { updated_at: new Date().toISOString() }
            if (updates.notes !== undefined) mktPayload.notes = updates.notes
            await (adminClient.from('marketing_records') as any).update(mktPayload).ilike('name', c.Candidate_name)
          }
        }
      }
    }
  }

  await supabase.from('audit_logs').insert(ids.map(id => ({ action: 'batch_updated', entity_type: 'candidate_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })))

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

  // Fetch candidate names before deleting, for sync
  const { data: candidates } = await supabase.from('Candidate_records').select('Candidate_name').in('id', ids)

  const { error } = await supabase.from('Candidate_records').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also delete from marketing_records if no other Candidate_records reference these candidates
  if (candidates) {
    const adminClient = getAdminClient()
    if (adminClient) {
      for (const c of candidates) {
        if (c.Candidate_name) {
          const { data: remaining } = await adminClient.from('Candidate_records').select('id').ilike('Candidate_name', c.Candidate_name).limit(1)
          if (!remaining || remaining.length === 0) {
            await (adminClient.from('marketing_records') as any).delete().ilike('name', c.Candidate_name)
          }
        }
      }
    }
  }

  await supabase.from('audit_logs').insert(ids.map(id => ({ action: 'batch_deleted', entity_type: 'candidate_record', entity_id: id, user_id: user.id, created_at: new Date().toISOString() })))

  return NextResponse.json({ success: true })
}
