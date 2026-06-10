'use client'

import { useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/client'

export default function RegisterAdminPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successEmail, setSuccessEmail] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('You must be logged in as an admin to register new admins.')
      }

      const res = await fetch('/api/admin/register', {
        signal: controller.signal,
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

      clearTimeout(timeoutId)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register admin')
      }

      setSuccessEmail(form.email)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.')
      } else {
        setError(err.message)
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!successEmail) return
    setError('')
    setLoading(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch('/api/admin/register', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName || 'Admin',
          email: successEmail,
          password: form.password || 'placeholder',
          resend: true
        })
      })

      clearTimeout(timeoutId)

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend')
      setError('')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check your connection and try again.')
      } else {
        setError(err.message)
      }
    } finally {
      clearTimeout(timeoutId)
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
        {successEmail ? (
          <div className="space-y-6">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-4 text-center">
              <div className="mb-3">
                <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-green-400 mb-2">Verification email sent</h2>
              <p className="text-sm text-green-300">
                We sent a confirmation link to <strong>{successEmail}</strong>.
                The admin must open that link to activate their account.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <div className="text-center space-y-4">
              <Link href="/login"
                className="block w-full bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-3 rounded-xl text-sm transition-all duration-200 text-center">
                Go to Login
              </Link>

              <div className="border-t border-[#2a2a2a] pt-4 space-y-3">
                <button onClick={handleResend} disabled={loading}
                  className="text-xs text-[#71717a] hover:text-white transition-colors">
                  {loading ? 'Sending...' : 'Resend verification email'}
                </button>
                <div>
                  <button onClick={() => { setSuccessEmail(''); setError('') }}
                    className="text-xs text-[#71717a] hover:text-white transition-colors">
                    Register another admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <div className="pt-2">
              <button type="submit" disabled={loading}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all duration-200">
                {loading ? 'Creating account...' : 'Send Admin Verification'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
