'use client'

import { useState } from 'react'

export default function SignOutButton({ role }: { role: 'admin' | 'employee' }) {
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = () => {
    setLoggingOut(true)
    document.cookie.split(';').forEach(c => {
      const name = c.trim().split('=')[0]
      if (name.startsWith('sb-') || name.startsWith('supabase-')) {
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Strict`
      }
    })
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = role === 'admin' ? '/admin-login' : '/login'
  }

  return (
    <button onClick={handleLogout} disabled={loggingOut}
      className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#a1a1aa] hover:text-red-400 hover:border-red-400/30 hover:bg-red-500/10 transition-all">
      {loggingOut ? 'Signing out...' : 'Sign Out'}
    </button>
  )
}
