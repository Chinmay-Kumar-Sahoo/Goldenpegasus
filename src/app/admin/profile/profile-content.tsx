'use client'

import { useState } from 'react'
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
  joining_date: string
  company_id: string
  designation: string
}

export default function AdminProfileContent({ initialProfile, initialEmployee }: { initialProfile?: Profile; initialEmployee?: Employee }) {
  const [profile, setProfile] = useState<Profile>(initialProfile || { full_name: '', email: '' })
  const [employee, setEmployee] = useState<Employee>(initialEmployee || { employee_id: '', contact: '', address: '', date_of_birth: '', joining_date: '', company_id: '', designation: '' })
  const [loading, setLoading] = useState(!initialProfile)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    setSaving(true)
    setError('')
    setSuccess('')

    const safetyTimer = setTimeout(() => { setSaving(false); setError('Save timed out after 15 seconds. Please try again.') }, 15000)

    try {
      if (employee.contact && /\D/.test(employee.contact)) {
        clearTimeout(safetyTimer); setError('Contact must contain only digits'); setSaving(false); return
      }
      if (newPassword && newPassword !== confirmPassword) {
        clearTimeout(safetyTimer); setError('Passwords do not match.'); setSaving(false); return
      }
      if (newPassword && newPassword.length < 8) {
        clearTimeout(safetyTimer); setError('Password must be at least 8 characters.'); setSaving(false); return
      }

      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { full_name: profile.full_name },
          employee: {
            employee_id: employee.employee_id,
            email: profile.email,
            contact: employee.contact,
            address: employee.address,
            date_of_birth: employee.date_of_birth,
            joining_date: employee.joining_date,
            company_id: employee.company_id,
            designation: employee.designation || 'Administrator',
          },
          newPassword: newPassword || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { clearTimeout(safetyTimer); setError(data.error); setSaving(false); return }

      clearTimeout(safetyTimer)
      setSuccess('Profile and security settings updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setSaving(false)
    } catch (err: any) {
      clearTimeout(safetyTimer)
      setError(err?.message || 'An unexpected error occurred')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <PageHeader title="Personal Details" subtitle="Update your personal information" />
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 space-y-4 max-w-2xl mt-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-[#1a1a1a] animate-pulse rounded-xl w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0">
        <PageHeader title="Personal Details" subtitle="Update your personal information" />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 mt-6">
        <div className="max-w-2xl">
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
                  { label: 'Admin ID', name: 'employee_id', type: 'text', inputMode: 'numeric', placeholder: 'e.g. 1001' },
                  { label: 'Designation', name: 'designation', type: 'text', placeholder: 'Administrator' },
                  { label: 'Contact', name: 'contact', type: 'text', inputMode: 'numeric', placeholder: '+1 234 567 8900' },
                  { label: 'Company ID', name: 'company_id', type: 'text', placeholder: 'GPEG-123' },
                  { label: 'Date of Birth', name: 'date_of_birth', type: 'date', placeholder: '' },
                  { label: 'Joining Date', name: 'joining_date', type: 'date', placeholder: '' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">{field.label}</label>
                    <input type={field.type} inputMode={(field as any).inputMode || 'text'} value={employee[field.name as keyof Employee] || ''} onChange={e => setEmployee({ ...employee, [field.name]: field.name === 'employee_id' ? e.target.value.replace(/\D/g, '') : e.target.value })} placeholder={field.placeholder}
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
    </div>
  )
}
