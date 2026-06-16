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

  const result = { candidates_removed: 0, marketing_removed: 0 }

  // 1. Dedup Candidate_records by (Candidate_name, technology) — keep original (oldest)
  const { data: candidateRecords } = await adminClient
    .from('Candidate_records')
    .select('id, Candidate_name, technology, created_at')
    .order('created_at', { ascending: true })
    .limit(5000)

  if (candidateRecords) {
    const seen = new Map<string, string[]>()
    for (const r of candidateRecords) {
      const key = ((r.Candidate_name || '') + '|' + (r.technology || '')).toLowerCase().trim()
      if (!key) continue
      if (!seen.has(key)) seen.set(key, [])
      seen.get(key)!.push(r.id)
    }
    const toDelete: string[] = []
    for (const [, ids] of seen) {
      if (ids.length > 1) toDelete.push(...ids.slice(1))
    }
    if (toDelete.length > 0) {
      const { error } = await adminClient.from('Candidate_records').delete().in('id', toDelete)
      if (!error) result.candidates_removed = toDelete.length
    }
  }

  // Note: marketing_records are a log of distinct activity (different clients, dates, recruiters).
  // Same name+technology can have many legitimate entries — NOT deduplicated here.

  return NextResponse.json({ message: 'Dedup complete', ...result })
}
