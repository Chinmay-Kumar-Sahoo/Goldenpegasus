import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

async function verifyAdmin(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return null

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null

  return { supabaseAdmin, adminUserId: user.id }
}

async function resendConfirmation(supabaseAdmin: ReturnType<typeof createClient>, email: string) {
  // Reset confirmation so a new email is triggered
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = existing?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (existingUser) {
    // Unconfirm so resend will send a fresh email
    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { email_confirmed_at: null })
  }
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

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Resend flow — no auth required so the new admin can request resend
    if (resend) {
      const { error: resendError } = await resendConfirmation(supabaseAdmin, email)
      if (resendError) {
        return NextResponse.json({ error: resendError.message }, { status: 400 })
      }
      return NextResponse.json({ message: 'Verification email resent.' })
    }

    // Create flow — requires admin auth
    if (!password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const verified = await verifyAdmin(request)
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedEmail = email.trim().toLowerCase()
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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data.user) {
      await supabaseAdmin.from('admin_profiles').upsert({
        user_id: data.user.id,
        email: normalizedEmail,
        full_name: fullName,
        is_root: false,
        status: data.user.email_confirmed_at ? 'active' : 'pending_verification',
        created_by: verified.adminUserId,
        email_confirmed_at: data.user.email_confirmed_at
      }, { onConflict: 'user_id' })

      if (data.user.email_confirmed_at) {
        await supabaseAdmin.from('profiles').upsert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: fullName,
          role: 'admin',
          must_change_password: false,
          email_confirmed_at: data.user.email_confirmed_at
        }, { onConflict: 'id' })
      }
    }

    return NextResponse.json({
      message: 'Admin signup created. A verification email has been sent before access is enabled.',
      user: data.user
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
