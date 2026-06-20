import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import SessionGuard from '@/components/SessionGuard'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Strictly enforce email confirmation
  if (!user.email_confirmed_at) {
    redirect('/login?error=Please confirm your email address first.')
  }

  const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name, email, role').eq('id', user.id).single()
  
  if (profileError || !profile) {
    redirect('/login?error=Account setup incomplete. Please contact support.')
  }

  // Redirect admins away from employee dashboard
  if (profile.role === 'admin') {
    redirect('/admin')
  }
  
  // Robust name fetching
  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Employee'

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <SessionGuard expectedRole="employee" />
      <Sidebar role="employee" userName={displayName} userEmail={profile?.email || user.email} />
      <main className="flex-1 flex flex-col min-h-0">
        {/* Global Header */}
        <header className="h-16 border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-6 md:px-8 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-sm font-semibold text-white">Welcome back, <span className="text-[#22c55e]">{displayName}</span>! 👋</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-bold uppercase tracking-wider">
                Active Session
              </div>
              <SignOutButton role="employee" />
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full flex-1 overflow-y-auto flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  )
}
