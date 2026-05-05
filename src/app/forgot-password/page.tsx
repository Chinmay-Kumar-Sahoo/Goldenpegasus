'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BackHomeNav from '@/components/BackHomeNav'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (resetError) {
      setError(resetError.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#22c55e]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md relative">
        <div className="flex justify-center">
          <BackHomeNav />
        </div>
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#22c55e] flex items-center justify-center font-bold text-black">GP</div>
            <span className="font-bold text-white">GoldenPegasus</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-sm text-[#71717a] mt-1">Enter your email to receive a reset link</p>
        </div>

        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📧</div>
              <h2 className="text-lg font-semibold text-white mb-2">Check your email</h2>
              <p className="text-sm text-[#71717a]">
                We&apos;ve sent a password reset link to <span className="text-white font-medium">{email}</span>.
                The link will expire in 1 hour.
              </p>
              <Link href="/login" className="inline-block mt-6 text-sm text-[#22c55e] hover:text-[#4ade80] transition-colors">
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5" htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-all"
                />
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all duration-200">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-[#71717a] hover:text-[#22c55e] transition-colors">← Back to login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
