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

export default function ProfileContent({ initialProfile, initialEmployee }: { initialProfile?: Profile; initialEmployee?: Employee }) {
  const [profile, setProfile] = useState<Profile>(initialProfile || { full_name: '', email: '' })
  const [employee, setEmployee] = useState<Employee>(initialEmployee || { employee_id: '', contact: '', address: '', date_of_birth: '', joining_date: '', company_id: '', designation: '' })
  const [loading, setLoading] = useState(!initialProfile)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const fieldsLocked = !!(initialEmployee?.employee_id)
  const joiningDateLocked = !!(initialEmployee?.joining_date)

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
            designation: employee.designation,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { clearTimeout(safetyTimer); setError(data.error); setSaving(false); return }

      clearTimeout(safetyTimer)
      setSuccess('Profile updated successfully!')
      setSaving(false)
      window.location.reload()
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
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
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
                  <input type="text" value={profile.full_name} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-[#71717a] cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Email</label>
                  <input type="email" value={profile.email} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-[#71717a] cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div className="border-t border-[#2a2a2a] pt-5">
              <div className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-4">Employee Details</div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Employee ID', name: 'employee_id', type: 'text', inputMode: 'numeric', placeholder: 'e.g. 1001' },
                  { label: 'Designation', name: 'designation', type: 'text', placeholder: 'Software Engineer' },
                  { label: 'Contact', name: 'contact', type: 'text', inputMode: 'numeric', placeholder: '+1 234 567 8900' },
                  { label: 'Company ID', name: 'company_id', type: 'text', placeholder: 'GPEG-123' },
                  { label: 'Date of Birth', name: 'date_of_birth', type: 'date', placeholder: '' },
                  { label: 'Joining Date', name: 'joining_date', type: 'date', placeholder: '' },
                ].map(field => {
                  const isLocked = field.name === 'joining_date' ? joiningDateLocked : fieldsLocked
                  return (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">{field.label}</label>
                    <input type={field.type} inputMode={(field as any).inputMode || 'text'} value={employee[field.name as keyof Employee] || ''} onChange={e => setEmployee({ ...employee, [field.name]: field.name === 'employee_id' ? e.target.value.replace(/\D/g, '') : e.target.value })} placeholder={field.placeholder} disabled={isLocked}
                      className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm ${isLocked ? 'text-[#71717a] cursor-not-allowed' : 'text-white focus:outline-none focus:border-[#22c55e]/60'}`} />
                  </div>
                  )
                })}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Address</label>
                  <textarea value={employee.address} onChange={e => setEmployee({ ...employee, address: e.target.value })} rows={2} placeholder="123 Main St, City, State" disabled={fieldsLocked}
                    className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm resize-none ${fieldsLocked ? 'text-[#71717a] cursor-not-allowed' : 'text-white focus:outline-none focus:border-[#22c55e]/60'}`} />
                </div>
              </div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">{success}</div>}

            {(!fieldsLocked || !joiningDateLocked) && (
              <button type="submit" disabled={saving}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </form>
        </div>
        </div>
      </div>
    </div>
  )
}
