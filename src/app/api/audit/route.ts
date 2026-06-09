import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

let _supabaseAdmin: ReturnType<typeof createAdminClient> | null = null
function getAdminClient() {
  if (_supabaseAdmin) return _supabaseAdmin
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (key) _supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _supabaseAdmin
}

const MAX_RECORDS = 2000

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = getAdminClient() || supabase

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await adminClient
    .from('audit_logs')
    .select('id, created_at, action, entity_type, entity_id, user_id, profiles(full_name)')
    .gte('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(MAX_RECORDS)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: data?.length || 0 })
}
