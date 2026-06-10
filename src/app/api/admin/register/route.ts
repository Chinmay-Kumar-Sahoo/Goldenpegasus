import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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

  try {
    const { data } = await supabaseAdmin
      .from('admin_profiles')
      .select('email, status')
      .eq('email', email)
      .maybeSingle()
    if (data) return 'This email is already registered as an admin.'
  } catch { /* table may not exist yet */ }

  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('email, role')
      .eq('email', email)
      .maybeSingle()
    if (data && typeof data === 'object' && 'role' in data) return 'This email is already registered.'
  } catch { /* skip */ }

  try {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existing = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (existing) return 'This email is already registered in the system.'
  } catch { /* auth list may not be available */ }

  return null
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

    if (resend) {
      const { error: resendError } = await resendConfirmation(normalizedEmail)
      if (resendError) return NextResponse.json({ error: resendError.message }, { status: 400 })
      return NextResponse.json({ message: 'Verification email resent.' })
    }

    if (!password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify admin via session cookie (sent automatically on same-origin fetch)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() { /* no-op */ }
        }
      }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
          created_by: user.id,
          email_confirmed_at: data.user.email_confirmed_at
        }, { onConflict: 'user_id' })
      } catch { /* admin_profiles table may not be available yet */ }
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
