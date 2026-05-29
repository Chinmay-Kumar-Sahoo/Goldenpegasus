'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * SessionGuard listens for auth state changes across browser tabs.
 * When a user logs in/out in another tab, this component detects the
 * change and redirects the current tab to the appropriate page.
 *
 * Props:
 *  - expectedRole: the role that should be active on this page ('admin' | 'employee')
 */
export default function SessionGuard({ expectedRole }: { expectedRole: 'admin' | 'employee' }) {
  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        // SIGNED_OUT means someone logged out (possibly from another tab)
        if (event === 'SIGNED_OUT') {
          window.location.href = expectedRole === 'admin' ? '/admin-login' : '/login'
          return
        }

        // TOKEN_REFRESHED or SIGNED_IN could mean a different user signed in from another tab
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            window.location.href = expectedRole === 'admin' ? '/admin-login' : '/login'
            return
          }

          // Check if the current user's role matches what this page expects
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (!profile) return

          if (profile.role !== expectedRole) {
            // Role mismatch — redirect to the correct dashboard
            if (profile.role === 'admin') {
              window.location.href = '/admin'
            } else {
              window.location.href = '/dashboard'
            }
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [expectedRole])

  return null
}
