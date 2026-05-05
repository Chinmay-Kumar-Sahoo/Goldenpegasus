import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name, email, role').eq('id', user.id).single()
  
  // Robust name fetching
  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Employee'

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar role="employee" userName={displayName} userEmail={profile?.email || user.email} />
      <main className="flex-1 overflow-auto">
        {/* Global Header */}
        <header className="h-16 border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-6 md:px-8">
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-sm font-semibold text-white">Welcome back, <span className="text-[#22c55e]">{displayName}</span>! 👋</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-bold uppercase tracking-wider">
                Active Session
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
