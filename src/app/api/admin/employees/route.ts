import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token)
    if (verifyError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const { data: profiles } = await supabaseAdmin.from('profiles').select('*')
    const { data: employees } = await supabaseAdmin.from('employees').select('*')

    const employeeMap = new Map((employees || []).map(e => [e.email?.toLowerCase(), e]))

    const merged = (authUsers?.users || []).map(u => {
      const p = (profiles || []).find(pr => pr.id === u.id)
      const emp = employeeMap.get(u.email?.toLowerCase())
      return {
        id: u.id,
        email: u.email,
        full_name: p?.full_name || u.user_metadata?.full_name || emp?.full_name || '',
        role: p?.role || u.user_metadata?.role || 'employee',
        email_confirmed_at: u.email_confirmed_at,
        employee_id: emp?.employee_id || null,
        contact: emp?.contact || null,
        designation: emp?.designation || null,
        created_at: u.created_at,
      }
    })

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ users: merged })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
