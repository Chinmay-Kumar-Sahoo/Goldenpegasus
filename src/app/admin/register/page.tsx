'use client'

import { useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'

export default function RegisterAdminPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register admin')
      }

      setMessage(`Admin signup created. A verification email has been sent to ${form.email}. The admin can sign in after confirming their email.`)
      setForm({ fullName: '', email: '', password: '', confirmPassword: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader 
        title="Register New Admin" 
        subtitle="Create an alternate admin account. Email verification is required before access is enabled."
      />

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 mt-6">
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5" htmlFor="fullName">Full Name</label>
            <input id="fullName" type="text" name="fullName" value={form.fullName} onChange={handleChange} required placeholder="Jane Doe"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5" htmlFor="email">Email address</label>
            <input id="email" type="email" name="email" value={form.email} onChange={handleChange} required placeholder="admin@example.com"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5" htmlFor="password">Password</label>
            <input id="password" type="password" name="password" value={form.password} onChange={handleChange} required placeholder="Min. 8 characters"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5" htmlFor="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required placeholder="••••••••"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">
              {message}
            </div>
          )}

          <div className="pt-2">
            <button type="submit" disabled={loading}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all duration-200">
              {loading ? 'Creating account...' : 'Send Admin Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
