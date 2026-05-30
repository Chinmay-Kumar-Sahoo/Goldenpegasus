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
  joining_date: string
  company_id: string
  designation: string
}

export default function ProfileContent({ initialProfile, initialEmployee }: { initialProfile?: Profile; initialEmployee?: Employee }) {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile>(initialProfile || { full_name: '', email: '' })
  const [employee, setEmployee] = useState<Employee>(initialEmployee || { employee_id: '', contact: '', address: '', date_of_birth: '', joining_date: '', company_id: '', designation: '' })
  const [loading, setLoading] = useState(!initialProfile)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const fieldsLocked = !!(initialEmployee?.employee_id)

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
      employee_id: employee.employee_id || `EMP-${Date.now()}`,
      full_name: profile.full_name,
      contact: employee.contact || null,
      address: employee.address || null,
      date_of_birth: employee.date_of_birth || null,
      joining_date: employee.joining_date || null,
      company_id: employee.company_id || null,
      designation: employee.designation || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (empError) { setError(empError.message); setSaving(false); return }
    setSuccess('Profile updated successfully!')
    setSaving(false)
    window.location.reload()
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Personal Details" subtitle="Update your personal information" />
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Personal Details" subtitle="Update your personal information" />
      <div className="max-w-2xl">
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <div className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-4">Account Information</div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Full Name</label>
                  <input type="text" value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} required disabled={fieldsLocked}
                    className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm ${fieldsLocked ? 'text-[#71717a] cursor-not-allowed' : 'text-white focus:outline-none focus:border-[#22c55e]/60'}`} />
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
                  { label: 'Employee ID', name: 'employee_id', type: 'text', placeholder: 'EMP-001' },
                  { label: 'Designation', name: 'designation', type: 'text', placeholder: 'Software Engineer' },
                  { label: 'Contact', name: 'contact', type: 'text', placeholder: '+1 234 567 8900' },
                  { label: 'Company ID', name: 'company_id', type: 'text', placeholder: 'GPEG-123' },
                  { label: 'Date of Birth', name: 'date_of_birth', type: 'date', placeholder: '' },
                  { label: 'Joining Date', name: 'joining_date', type: 'date', placeholder: '' },
                ].map(field => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">{field.label}</label>
                    <input type={field.type} value={employee[field.name as keyof Employee] || ''} onChange={e => setEmployee({ ...employee, [field.name]: e.target.value })} placeholder={field.placeholder} disabled={fieldsLocked}
                      className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm ${fieldsLocked ? 'text-[#71717a] cursor-not-allowed' : 'text-white focus:outline-none focus:border-[#22c55e]/60'}`} />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Address</label>
                  <textarea value={employee.address} onChange={e => setEmployee({ ...employee, address: e.target.value })} rows={2} placeholder="123 Main St, City, State" disabled={fieldsLocked}
                    className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm resize-none ${fieldsLocked ? 'text-[#71717a] cursor-not-allowed' : 'text-white focus:outline-none focus:border-[#22c55e]/60'}`} />
                </div>
              </div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">{success}</div>}

            {!fieldsLocked && (
              <button type="submit" disabled={saving}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
