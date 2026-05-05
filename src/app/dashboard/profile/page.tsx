'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function ProfilePage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [profile, setProfile] = useState<Profile>({ full_name: '', email: '' })
  const [employee, setEmployee] = useState<Employee>({ employee_id: '', contact: '', address: '', date_of_birth: '', company_id: '', designation: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: prof }, { data: emp }] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
        supabase.from('employees').select('*').eq('user_id', user.id).maybeSingle(),
      ])

      if (prof) setProfile({ 
        full_name: prof.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '', 
        email: prof.email || user.email || '' 
      })
      if (emp) setEmployee({
        employee_id: emp.employee_id || '',
        contact: emp.contact || '',
        address: emp.address || '',
        date_of_birth: emp.date_of_birth || '',
        company_id: emp.company_id || '',
        designation: emp.designation || '',
      })
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Update profile
    const { error: profError } = await supabase.from('profiles').update({ full_name: profile.full_name, updated_at: new Date().toISOString() }).eq('id', user.id)
    if (profError) { setError(profError.message); setSaving(false); return }

    // Upsert employee record
    const { error: empError } = await supabase.from('employees').upsert({
      user_id: user.id,
      employee_id: employee.employee_id || `EMP-${Date.now()}`,
      full_name: profile.full_name,
      email: profile.email,
      contact: employee.contact || null,
      address: employee.address || null,
      date_of_birth: employee.date_of_birth || null,
      company_id: employee.company_id || null,
      designation: employee.designation || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (empError) { setError(empError.message); setSaving(false); return }
    setSuccess('Profile updated successfully!')
    setSaving(false)
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
              <div className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-4">Employee Details</div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Employee ID', name: 'employee_id', type: 'text', placeholder: 'EMP-001' },
                  { label: 'Designation', name: 'designation', type: 'text', placeholder: 'Software Engineer' },
                  { label: 'Contact', name: 'contact', type: 'text', placeholder: '+1 234 567 8900' },
                  { label: 'Company ID', name: 'company_id', type: 'text', placeholder: 'GP-123' },
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

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
            {success && <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">{success}</div>}

            <button type="submit" disabled={saving}
              className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-black font-bold py-3 rounded-xl text-sm transition-all">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
