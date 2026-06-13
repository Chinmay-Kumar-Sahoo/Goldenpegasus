import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json()
    const { profile, employee, newPassword } = body

    if (!profile) return NextResponse.json({ error: 'Profile data required' }, { status: 400 })

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: profError } = await serviceSupabase.from('profiles').update({ full_name: profile.full_name, updated_at: new Date().toISOString() }).eq('id', user.id)
    if (profError) return NextResponse.json({ error: profError.message }, { status: 500 })

    if (employee) {
      const { error: empError } = await serviceSupabase.from('employees').upsert({
        user_id: user.id,
        employee_id: employee.employee_id || (employee.designation === 'Administrator' ? `ADM-${Date.now()}` : `EMP-${Date.now()}`),
        full_name: profile.full_name,
        ...(employee.email !== undefined && { email: employee.email }),
        contact: employee.contact || null,
        address: employee.address || null,
        date_of_birth: employee.date_of_birth || null,
        joining_date: employee.joining_date || null,
        company_id: employee.company_id || null,
        designation: employee.designation || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })
    }

    if (newPassword) {
      const { error: authError } = await serviceSupabase.auth.admin.updateUserById(user.id, { password: newPassword })
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
      await serviceSupabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
