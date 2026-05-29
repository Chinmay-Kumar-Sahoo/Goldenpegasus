'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'

interface Profile {
  full_name: string
  email: string
}

interface Employee {
  employee_id: string
  contact: string
  address: string
  date_of_birth: string
  company_id: string
  designation: string
}

export default function AdminProfileContent({ initialProfile, initialEmployee }: { initialProfile?: Profile; initialEmployee?: Employee }) {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile>(initialProfile || { full_name: '', email: '' })
  const [employee, setEmployee] = useState<Employee>(initialEmployee || { employee_id: '', contact: '', address: '', date_of_birth: '', company_id: '', designation: '' })
  const [loading, setLoading] = useState(!initialProfile)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const ensureUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const userId = await ensureUserId()
    if (!userId) return

    const { error: profError } = await supabase.from('profiles').update({ full_name: profile.full_name, updated_at: new Date().toISOString() }).eq('id', userId)
    if (profError) { setError(profError.message); setSaving(false); return }

    const { error: empError } = await supabase.from('employees').upsert({
      user_id: userId,
      employee_id: employee.employee_id || `ADM-${Date.now()}`,
      full_name: profile.full_name,
      email: profile.email,
      contact: employee.contact || null,
      address: employee.address || null,
      date_of_birth: employee.date_of_birth || null,
      company_id: employee.company_id || null,
      designation: employee.designation || 'Administrator',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (empError) { setError(empError.message); setSaving(false); return }

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.')
        setSaving(false)
        return
      }
      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters.')
        setSaving(false)
        return
      }

      const { error: authError } = await supabase.auth.updateUser({ password: newPassword })
      if (authError) {
        setError(`Password update failed: ${authError.message}`)
        setSaving(false)
        return
      }
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', userId)
    }

    setSuccess('Profile and security settings updated successfully!')
    setNewPassword('')
    setConfirmPassword('')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Personal Details" subtitle="Update your personal information" />
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 space-y-4 max-w-2xl mt-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-[#1a1a1a] animate-pulse rounded-xl w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader title="Personal Details" subtitle="Update your personal information" />
      <div className="max-w-2xl mt-6">
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <div className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-4">Account Information</div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Full Name</label>
                  <input type="text" value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} required
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Email</label>
                  <input type="email" value={profile.email} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-[#71717a] cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div className="border-t border-[#2a2a2a] pt-5">
              <div className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-4">Contact Details</div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Admin ID', name: 'employee_id', type: 'text', placeholder: 'ADM-001' },
                  { label: 'Designation', name: 'designation', type: 'text', placeholder: 'Administrator' },
                  { label: 'Contact', name: 'contact', type: 'text', placeholder: '+1 234 567 8900' },
                  { label: 'Company ID', name: 'company_id', type: 'text', placeholder: 'GPEG-123' },
                  { label: 'Date of Birth', name: 'date_of_birth', type: 'date', placeholder: '' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">{field.label}</label>
                    <input type={field.type} value={employee[field.name as keyof Employee] || ''} onChange={e => setEmployee({ ...employee, [field.name]: e.target.value })} placeholder={field.placeholder}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Address</label>
                  <textarea value={employee.address} onChange={e => setEmployee({ ...employee, address: e.target.value })} rows={2} placeholder="123 Main St, City, State"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 resize-none" />
                </div>
              </div>
            </div>

            <div className="border-t border-[#2a2a2a] pt-5">
              <div className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider mb-4">Security & Password</div>
              <p className="text-xs text-[#71717a] mb-4">You can update your password at any time. Leave blank to keep current password.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">New Password</label>
                  <input type="password" name="newPassword" placeholder="••••••••"
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Confirm New Password</label>
                  <input type="password" name="confirmPassword" placeholder="••••••••"
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/60" />
                </div>
              </div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">{success}</div>}

            <button type="submit" disabled={saving}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all">
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
