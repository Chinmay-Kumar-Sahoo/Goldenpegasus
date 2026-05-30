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
  password: string
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormData>({ employee_id: '', full_name: '', email: '', contact: '', designation: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>('')
  const [successMessage, setSuccessMessage] = useState('')
  const [confirmationLink, setConfirmationLink] = useState('')

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
      setForm({ employee_id: emp.employee_id || '', full_name: emp.full_name, email: emp.email, contact: emp.contact || '', designation: emp.designation || '', password: '' })
    } else {
      setEditing(null)
      setForm({ employee_id: '', full_name: '', email: '', contact: '', designation: '', password: '' })
    }
    setError('')
    setSuccessMessage('')
    setConfirmationLink('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccessMessage('')
    let saveError: string | null = null
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
      })
      const json = await res.json()
      if (!res.ok) {
        saveError = json.error || 'Failed to save'
        setError(saveError)
      } else if (!editing) {
        setSuccessMessage(json.message || 'Employee created successfully.')
        setConfirmationLink(json.confirmationLink || '')
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

  return (
    <div>
      <PageHeader title="Employee Management" subtitle="Manage all employee records">
        <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          + Add Employee
        </button>
      </PageHeader>

      {successMessage && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400 space-y-2">
          <div>{successMessage}</div>
          {confirmationLink && (
            <div className="flex items-center gap-2">
              <input readOnly value={confirmationLink} onClick={e => (e.target as HTMLInputElement).select()}
                className="flex-1 bg-black/30 border border-green-500/20 rounded-lg px-3 py-1.5 text-xs text-green-300 font-mono truncate focus:outline-none cursor-text" />
              <button onClick={() => { navigator.clipboard.writeText(confirmationLink); setSuccessMessage('Link copied!') }}
                className="shrink-0 text-[10px] bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 px-2 py-1.5 rounded-lg text-green-300 transition-all">Copy</button>
            </div>
          )}
        </div>
      )}

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
                ...(editing ? [] : [{ label: 'Password', name: 'password' as const, type: 'password' as const, placeholder: 'Min. 8 characters' }]),
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">{field.label}</label>
                  <input type={field.type} value={form[field.name as keyof FormData]} onChange={e => setForm({ ...form, [field.name]: e.target.value })} placeholder={field.placeholder}
                    required={['employee_id', 'full_name', 'email'].includes(field.name) || (!editing && field.name === 'password')}
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
