import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const DATE_FIELDS = ['date', 'project_start_date', 'project_end_date', 'interview_date']

  const { data: _records } = await adminClient
    .from('marketing_records')
    .select(`id, ${DATE_FIELDS.join(', ')}`)
  const records: any[] = _records || []

  if (!records.length) return NextResponse.json({ updated: 0 })

  const addDay = (iso: string | null) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  let totalUpdated = 0

  for (const rec of records) {
    const updates: Record<string, any> = {}
    for (const field of DATE_FIELDS) {
      const original = rec[field]
      const fixed = addDay(original)
      if (fixed !== original) {
        updates[field] = fixed
      }
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await adminClient.from('marketing_records').update(updates).eq('id', rec.id)
      totalUpdated++
    }
  }

  return NextResponse.json({ updated: totalUpdated })
}
