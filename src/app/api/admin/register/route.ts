import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
}

async function checkEmailExists(email: string): Promise<string | null> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getServiceRoleKey()!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check admin_profiles
  try {
    const { data } = await supabaseAdmin
      .from('admin_profiles')
      .select('email, status')
      .eq('email', email)
      .maybeSingle()
    if (data) return 'This email is already registered as an admin.'
  } catch { /* table may not exist yet */ }

  // Check profiles
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('email, role')
      .eq('email', email)
      .maybeSingle()
    if (data && typeof data === 'object' && 'role' in data) return 'This email is already registered.'
  } catch { /* skip */ }

  // Check Auth users
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
  const existing = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) return 'This email is already registered in the system.'

  return null
}

async function verifyAdmin(request: Request) {
  const key = getServiceRoleKey()
  if (!key) return null

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single() as any
  if (profile?.role !== 'admin') return null

  return { adminUserId: user.id }
}

async function resendConfirmation(email: string) {
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  return supabaseClient.auth.resend({ type: 'signup', email })
}

export async function POST(request: Request) {
  try {
    const { fullName, email, password, resend } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const key = getServiceRoleKey()
    if (!key) {
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local' },
        { status: 500 }
      )
    }

    // Resend flow — no auth required so the invitee can request a resend
    if (resend) {
      const { error: resendError } = await resendConfirmation(normalizedEmail)
      if (resendError) return NextResponse.json({ error: resendError.message }, { status: 400 })
      return NextResponse.json({ message: 'Verification email resent.' })
    }

    // Create flow — requires admin auth
    if (!password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const verified = await verifyAdmin(request)
    if (!verified) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if email already exists
    const existsError = await checkEmailExists(normalizedEmail)
    if (existsError) return NextResponse.json({ error: existsError }, { status: 409 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const supabaseSignup = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseSignup.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${appUrl.replace(/\/$/, '')}/auth/verify?next=/admin`,
        data: { full_name: fullName, role: 'admin' }
      }
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (data.user) {
      const isAutoConfirmed = !!data.user.email_confirmed_at
      const status = isAutoConfirmed ? 'active' : 'pending_verification'

      // Upsert into admin_profiles
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          key,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        await adminClient.from('admin_profiles').upsert({
          user_id: data.user.id,
          email: normalizedEmail,
          full_name: fullName,
          is_root: false,
          status,
          created_by: verified.adminUserId,
          email_confirmed_at: data.user.email_confirmed_at
        }, { onConflict: 'user_id' })
      } catch { /* admin_profiles table may not be available yet */ }

      // Profile is created automatically by the handle_user_email_confirmed DB trigger
      // when the user confirms their email. We do NOT create it here.
    }

    return NextResponse.json({
      message: 'Admin signup created. A verification email has been sent before access is enabled.',
      emailSent: !data.user?.email_confirmed_at,
      user: data.user
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
