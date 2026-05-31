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
        designation: emp?.designation || null,
        created_at: p.created_at,
      }
    })

    return NextResponse.json({ users: merged })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const auth = await checkAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()

    if (body.id) {
      const updateData = { ...body }
      delete updateData.id
      delete updateData.password
      const { error } = await supabase.from('employees').update(updateData).eq('user_id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logAudit(supabase, auth.user.id, 'updated', 'employee', body.id)
      return NextResponse.json({ success: true })
    }

    if (!body.password) {
      return NextResponse.json({ error: 'Password is required to create a new employee' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
    const email = body.email.trim().toLowerCase()

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: false,
      user_metadata: {
        full_name: body.full_name,
        role: 'employee',
        employee_id: body.employee_id || '',
        contact: body.contact || '',
        designation: body.designation || '',
      },
    })

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })
    const userId = userData.user.id

    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      options: { redirectTo: `${appUrl.replace(/\/$/, '')}/auth/verify?next=/login` },
    } as any)

    const actionLink = linkData?.properties?.action_link || ''
    const customRedirect = `${appUrl.replace(/\/$/, '')}/auth/verify?next=${encodeURIComponent('/login?email_confirmed=true')}`
    const confirmationLink = actionLink.replace(/redirect_to=[^&]+/, `redirect_to=${encodeURIComponent(customRedirect)}`)

    await logAudit(supabase, auth.user.id, 'employee_created_pending', 'employee', userId)

    return NextResponse.json({
      success: true,
      confirmationLink,
      message: 'Employee created. Share this verification link with them to activate their account:',
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
    const { error } = await supabase.from('employees').delete().eq('user_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAudit(supabase, auth.user.id, 'deleted', 'employee', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
