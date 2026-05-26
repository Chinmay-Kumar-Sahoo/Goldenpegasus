'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

export default function BackHomeNav() {
  const router = useRouter()
  const pathname = usePathname()

  const handleBack = () => {
    // Prevent infinite redirect loops when going back to login pages
    if (pathname === '/admin' || pathname === '/dashboard') {
      router.push('/')
      return
    }

    // Check if we have history to go back to safely
    if (typeof window !== 'undefined' && window.history.length > 2) {
      router.back()
    } else {
      // Fallbacks if opened directly in a new tab
      if (pathname?.startsWith('/admin/')) router.push('/admin')
      else if (pathname?.startsWith('/dashboard/')) router.push('/dashboard')
      else router.push('/')
    }
  }

  return (
    <div className="flex items-center gap-2 mb-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={handleBack}
        suppressHydrationWarning
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#a1a1aa] hover:text-white hover:border-[#3a3a3a] hover:bg-[#222222] transition-all duration-200 text-xs font-medium group"
        aria-label="Go back"
      >
        <svg
          className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Divider */}
      <span className="text-[#2a2a2a] text-sm select-none">/</span>

      {/* Home Button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#a1a1aa] hover:text-[#22c55e] hover:border-[#22c55e]/30 hover:bg-[#22c55e]/5 transition-all duration-200 text-xs font-medium group"
        aria-label="Go to home page"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Home
      </Link>
    </div>
  )
}
