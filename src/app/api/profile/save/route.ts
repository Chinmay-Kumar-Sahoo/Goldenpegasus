import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json()
    const { profile, employee, newPassword } = body

    if (!profile) return Response.json({ error: 'Profile data required' }, { status: 400 })

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error: profError } = await serviceSupabase.from('profiles').update({ full_name: profile.full_name, updated_at: new Date().toISOString() }).eq('id', user.id)
    if (profError) return Response.json({ error: profError.message }, { status: 500 })

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
      if (empError) return Response.json({ error: empError.message }, { status: 500 })
    }

    if (newPassword) {
      const { error: authError } = await serviceSupabase.auth.admin.updateUserById(user.id, { password: newPassword })
      if (authError) return Response.json({ error: authError.message }, { status: 500 })

      await serviceSupabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)
    }

    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ error: err?.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
