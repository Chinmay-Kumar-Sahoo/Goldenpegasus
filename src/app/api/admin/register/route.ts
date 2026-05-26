import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { fullName, email, password } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if SUPABASE_SERVICE_ROLE_KEY is configured
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local' },
        { status: 500 }
      )
    }

    // Create a Supabase admin client with the service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the caller is an admin
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token)
    if (verifyError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if caller is actually admin
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only admins can register new admins.' }, { status: 403 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const supabaseSignup = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Alternate admins must confirm email before they can access the admin portal.
    const { data, error } = await supabaseSignup.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${appUrl.replace(/\/$/, '')}/auth/verify?next=/admin`,
        data: {
          full_name: fullName,
          role: 'admin'
        }
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
        created_by: user.id,
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
