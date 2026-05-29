'use client'

import { useState, useEffect, useCallback } from 'react'
import PageHeader from '@/components/PageHeader'

interface Employee {
  id: string
  employee_id: string | null
  full_name: string
  email: string
  contact: string | null
  designation: string | null
  role: string
  email_confirmed_at: string | null
  created_at: string
}

interface FormData {
  employee_id: string
  full_name: string
  email: string
  contact: string
  designation: string
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormData>({ employee_id: '', full_name: '', email: '', contact: '', designation: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>('')

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/employees')
      const json = await res.json()
      setEmployees(json.users || [])
    } catch {
      setEmployees([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const openModal = (emp?: Employee) => {
    if (emp) {
      setEditing(emp)
      setForm({ employee_id: emp.employee_id || '', full_name: emp.full_name, email: emp.email, contact: emp.contact || '', designation: emp.designation || '' })
    } else {
      setEditing(null)
      setForm({ employee_id: '', full_name: '', email: '', contact: '', designation: '' })
    }
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    let saveError: string | null = null
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
      })
      if (!res.ok) {
        const json = await res.json()
        saveError = json.error || 'Failed to save'
        setError(saveError)
      }
    } catch {
      saveError = 'Failed to save'
      setError('Failed to save employee')
    }
    setSaving(false)
    if (!saveError) {
      setShowModal(false)
      fetchEmployees()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this employee?')) return
    try {
      await fetch('/api/admin/employees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      fetchEmployees()
    } catch {}
  }

  const filtered = employees.filter(e =>
    e.role === 'employee' && (
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.employee_id || '').toLowerCase().includes(search.toLowerCase())
    )
  )

  const admins = employees.filter(e => e.role === 'admin')

  return (
    <div>
      <PageHeader title="Employee Management" subtitle="Manage all employee records">
        <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          + Add Employee
        </button>
      </PageHeader>

      <div className="mb-6">
        <input type="text" placeholder="Search by name, email, or ID..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full md:w-96 bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60" />
      </div>

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Employee ID', 'Full Name', 'Email', 'Contact', 'Designation', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#71717a] text-sm">No employees found.</td></tr>
              ) : (
                filtered.map(emp => (
                  <tr key={emp.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-[#22c55e] font-mono">{emp.employee_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{emp.full_name}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{emp.email}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{emp.contact || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{emp.designation || '—'}</td>
                    <td className="px-4 py-3">
                      {emp.email_confirmed_at ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-bold uppercase tracking-wider">Verified</span>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold uppercase tracking-wider">Unverified</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openModal(emp)} className="text-xs bg-[#1a1a1a] hover:bg-[#22c55e]/10 hover:text-[#22c55e] border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Edit</button>
                        <button onClick={() => handleDelete(emp.id)} className="text-xs bg-[#1a1a1a] hover:bg-red-500/10 hover:text-red-400 border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Management Table */}
      <div className="mt-8 mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Admin Management</h2>
          <p className="text-sm text-[#71717a] mt-0.5">Manage all admin accounts</p>
        </div>
        {admins.length === 0 ? (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 text-center">
            <p className="text-[#71717a] text-sm">No admin accounts.</p>
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {['Full Name', 'Email', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map(adm => (
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
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#3a3a3a]">—</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-white mb-6">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              {[
                { label: 'Employee ID', name: 'employee_id', type: 'text', placeholder: 'EMP-001' },
                { label: 'Full Name', name: 'full_name', type: 'text', placeholder: 'John Doe' },
                { label: 'Email', name: 'email', type: 'email', placeholder: 'john@example.com' },
                { label: 'Contact', name: 'contact', type: 'text', placeholder: '+1 234 567 8900' },
                { label: 'Designation', name: 'designation', type: 'text', placeholder: 'Software Engineer' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">{field.label}</label>
                  <input type={field.type} value={form[field.name as keyof FormData]} onChange={e => setForm({ ...form, [field.name]: e.target.value })} placeholder={field.placeholder}
                    required={['employee_id', 'full_name', 'email'].includes(field.name)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
                </div>
              ))}
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
