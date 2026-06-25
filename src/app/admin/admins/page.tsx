'use client'

import { useState, useEffect } from 'react'
import PageHeader from '@/components/PageHeader'
import { formatDate } from '@/lib/dates'

interface Admin {
  id: string
  email: string
  full_name: string
  role: string
  email_confirmed_at: string | null
  created_at: string
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/admins')
        const json = await res.json()
        setAdmins(json.admins || [])
      } catch {
        setAdmins([])
      }
      setLoading(false)
    })()
  }, [])

  return (
    <div>
      <PageHeader title="Admin Management" subtitle="Manage all admin accounts" />

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Full Name', 'Email', 'Status', 'Created'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : admins.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-[#71717a] text-sm">No admin accounts.</td></tr>
              ) : (
                admins.map(adm => (
                  <tr key={adm.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{adm.full_name}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{adm.email}</td>
                    <td className="px-4 py-3">
                      {adm.email_confirmed_at ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-bold uppercase tracking-wider">Verified</span>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold uppercase tracking-wider">Unverified</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{formatDate(adm.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
