import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json()
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the caller's session
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(idToken)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email not yet confirmed' }, { status: 400 })
    }

    const email = user.email?.toLowerCase() || ''
    const fullName = user.user_metadata?.full_name || email.split('@')[0]

    // Check if the profiles entry already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      // Create the profiles entry (should have been created by DB trigger, but just in case)
      await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        email,
        full_name: fullName,
        role: 'admin',
        must_change_password: false,
        email_confirmed_at: user.email_confirmed_at
      }, { onConflict: 'id' })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
