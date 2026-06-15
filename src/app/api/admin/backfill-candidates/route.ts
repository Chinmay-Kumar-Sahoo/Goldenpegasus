import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return NextResponse.json({ error: 'No service role key configured' }, { status: 500 })
  const adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: marketingRecords } = await adminClient
    .from('marketing_records')
    .select('name, technology, owner_id')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (!marketingRecords || marketingRecords.length === 0) {
    return NextResponse.json({ message: 'No marketing records found', created: 0 })
  }

  const uniqueNames = [...new Set(marketingRecords.map(r => r.name).filter(Boolean))] as string[]
  const filters = uniqueNames.map(n => `Candidate_name.ilike.${n}`).join(',')
  const { data: existingCandidates } = await adminClient
    .from('Candidate_records')
    .select('Candidate_name')
    .or(filters)

  const existingKeySet = new Set((existingCandidates || []).map((c: any) => ((c.Candidate_name || '') + '|' + (c.technology || '')).toLowerCase().trim()).filter(Boolean))
  const seen = new Set<string>()
  const payloads: any[] = []
  const now = new Date().toISOString()

  for (const r of marketingRecords) {
    const n = (r.name || '').toLowerCase().trim()
    if (!n) continue
    const key = n + '|' + ((r.technology || '') + '').toLowerCase().trim()
    if (existingKeySet.has(key) || seen.has(key)) continue
    seen.add(key)
    payloads.push({ Candidate_name: r.name, technology: r.technology || null, owner_id: r.owner_id || null, status: 'Active', updated_at: now })
  }

  if (payloads.length === 0) {
    return NextResponse.json({ message: 'All marketing records already have Candidate_records entries', created: 0 })
  }

  const { data: created, error } = await adminClient.from('Candidate_records').insert(payloads).select()
  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 })
  }

  return NextResponse.json({ message: 'Backfill complete', created: created?.length || 0, records: created })
}
