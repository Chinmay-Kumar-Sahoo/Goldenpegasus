import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden', status: 403 }
  return { user }
}

async function logAudit(supabase: any, userId: string, action: string, entityType: string, entityId: string) {
  await supabase.from('audit_logs').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    user_id: userId,
    created_at: new Date().toISOString(),
  })
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const auth = await checkAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    const { data: employees } = await supabase.from('employees').select('*')

    const employeeMap = new Map((employees || []).map(e => [e.email?.toLowerCase(), e]))

    const merged = (profiles || []).map(p => {
      const emp = employeeMap.get(p.email?.toLowerCase())
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name || '',
        role: p.role || 'employee',
        email_confirmed_at: p.email_confirmed_at,
        employee_id: emp?.employee_id || null,
        contact: emp?.contact || null,
        country_code: emp?.country_code || null,
        designation: emp?.designation || null,
        joining_date: emp?.joining_date ?? null,
        created_at: p.created_at,
        created_by_admin: emp?.created_by_admin || null,
      }
    })

    return NextResponse.json({ users: merged })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const auth = await checkAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (body.id) {
      // Editing an existing employee
      const newEmail = String(body.email || '').trim().toLowerCase()
      if (newEmail && !EMAIL_RE.test(newEmail)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })

      // Check if this employee was created by admin
      const { data: existingEmp } = await supabaseAdmin.from('employees').select('created_by_admin, email, employee_id').eq('user_id', body.id).maybeSingle()

      // Duplicate employee_id check
      const sanitizedEmpId = String(body.employee_id || '').replace(/\D/g, '')
      if (sanitizedEmpId && existingEmp && existingEmp.employee_id !== sanitizedEmpId) {
        const { data: dupEmp } = await supabaseAdmin.from('employees').select('id').eq('employee_id', sanitizedEmpId).maybeSingle()
        if (dupEmp) return NextResponse.json({ error: 'Employee ID already exists. Please use a different ID.' }, { status: 409 })
      }

      const updateData: Record<string, any> = {}
      for (const [key, val] of Object.entries(body)) {
        if (key === 'id' || key === 'password') continue
        if ((key === 'joining_date' || key === 'date_of_birth') && !val) continue
        if (key === 'contact') { updateData.contact = String(val || '').replace(/\D/g, ''); continue }
        if (key === 'employee_id') { updateData.employee_id = String(val || '').replace(/\D/g, ''); continue }
        if (key === 'country_code') { updateData.country_code = val; continue }
        updateData[key] = val
      }

      // Always set full_name from profiles
      if (body.full_name) {
        updateData.full_name = body.full_name
      }

      const { error } = await supabaseAdmin.from('employees').update(updateData).eq('user_id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Update profile full_name
      if (body.full_name) {
        await supabaseAdmin.from('profiles').update({ full_name: body.full_name, updated_at: new Date().toISOString() }).eq('id', body.id)
      }

      // Update email in auth if changed and employee was created by admin
      if (newEmail && existingEmp && existingEmp.created_by_admin) {
        const oldEmail = (existingEmp.email || '').toLowerCase()
        if (newEmail !== oldEmail) {
          // Update auth email
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(body.id, { email: newEmail })
          if (authError) return NextResponse.json({ error: `Failed to update auth email: ${authError.message}` }, { status: 500 })
          // Update email in employees table
          await supabaseAdmin.from('employees').update({ email: newEmail }).eq('user_id', body.id)
          // Update email in profiles table
          await supabaseAdmin.from('profiles').update({ email: newEmail }).eq('id', body.id)
        }
      }

      await logAudit(supabase, auth.user.id, 'updated', 'employee', body.id)
      return NextResponse.json({ success: true, message: 'Employee updated successfully.' })
    }

    // Creating a new employee
    if (!body.password) {
      return NextResponse.json({ error: 'Password is required to create a new employee' }, { status: 400 })
    }

    const email = body.email.trim().toLowerCase()
    const contactDigits = (body.contact || '').replace(/\D/g, '')
    const sanitizedNewEmpId = (body.employee_id || '').replace(/\D/g, '')

    // Duplicate employee_id check on create
    if (sanitizedNewEmpId) {
      const { data: dupEmp } = await supabaseAdmin.from('employees').select('id').eq('employee_id', sanitizedNewEmpId).maybeSingle()
      if (dupEmp) return NextResponse.json({ error: 'Employee ID already exists. Please use a different ID.' }, { status: 409 })
    }

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: 'employee',
        employee_id: sanitizedNewEmpId,
        contact: contactDigits,
        country_code: body.country_code || '+1',
        designation: body.designation || '',
        joining_date: body.joining_date || '',
      },
    })

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })
    const userId = userData.user.id

    // Mark as admin-created in the employees table
    await supabaseAdmin.from('employees').update({
      created_by_admin: true,
      country_code: body.country_code || '+1',
    }).eq('user_id', userId)

    await logAudit(supabase, auth.user.id, 'employee_created', 'employee', userId)

    return NextResponse.json({
      success: true,
      message: 'Employee created successfully. They can now log in using the email and password set by Admin.',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const auth = await checkAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { id } = await req.json()

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Clean up references in related tables (best-effort, don't block deletion)
    try { await supabaseAdmin.from('Candidate_records').update({ owner_id: null }).eq('owner_id', id) } catch {}
    try { await supabaseAdmin.from('Candidate_records').update({ backup_employee_id: null }).eq('backup_employee_id', id) } catch {}
    try { await supabaseAdmin.from('marketing_records').update({ owner_id: null }).eq('owner_id', id) } catch {}
    try { await supabaseAdmin.from('marketing_reminder_logs').delete().eq('owner_id', id) } catch {}

    // Try to delete from auth (may already be gone — that's ok)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (deleteError && !deleteError.message?.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Remove the profile row so it doesn't reappear as a stale record
    try { await supabaseAdmin.from('profiles').delete().eq('id', id) } catch {}
    try { await supabaseAdmin.from('employees').delete().eq('user_id', id) } catch {}

    await logAudit(supabase, auth.user.id, 'deleted', 'employee', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
