'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import PageHeader from '@/components/PageHeader'
import { formatDate } from '@/lib/format'
import toast from 'react-hot-toast'

interface Employee {
  id: string
  employee_id: string | null
  full_name: string
  email: string
  contact: string | null
  designation: string | null
  joining_date: string | null
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
  joining_date: string
  password: string
}

const DATE_COLUMNS: Record<string, string> = {
  'Joining Date': 'joining_date',
}

function inRange(val: string | null, range: { start: string; end: string }): boolean {
  if (!range.start && !range.end) return true
  const d = (val || '').split('T')[0]
  if (!d) return false
  if (range.start && d < range.start) return false
  if (range.end && d > range.end) return false
  return true
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormData>({ employee_id: '', full_name: '', email: '', contact: '', designation: '', joining_date: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null)
  const [dateFilters, setDateFilters] = useState({
    joining_date: { start: '', end: '' },
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState({ designation: '', contact: '' })
  const [bulkSaving, setBulkSaving] = useState(false)

  const dateFilterRef = useRef<HTMLTableSectionElement>(null)

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

  useEffect(() => {
    if (!activeDateFilter) return
    const handleClick = (e: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
        setActiveDateFilter(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeDateFilter])

  const openModal = (emp?: Employee) => {
    if (emp) {
      setEditing(emp)
      setForm({ employee_id: emp.employee_id || '', full_name: emp.full_name, email: emp.email, contact: emp.contact || '', designation: emp.designation || '', joining_date: emp.joining_date || '', password: '' })
    } else {
      setEditing(null)
      setForm({ employee_id: '', full_name: '', email: '', contact: '', designation: '', joining_date: '', password: '' })
    }
    setError('')
    setSuccessMessage('')
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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(r => r.id)))
  }

  const handleBulkUpdate = async () => {
    const updates = Object.fromEntries(Object.entries(bulkForm).filter(([_, v]) => v !== ''))
    if (Object.keys(updates).length === 0) { toast.error('No fields to update'); return }
    setBulkSaving(true)
    try {
      const res = await fetch('/api/admin/employees/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates }),
      })
      if (!res.ok) throw new Error('Failed to bulk update')
      toast.success(`Updated ${selectedIds.size} employees`)
      setShowBulkModal(false)
      setSelectedIds(new Set())
      setBulkForm({ designation: '', contact: '' })
      fetchEmployees()
    } catch {
      toast.error('Failed to bulk update')
    }
    setBulkSaving(false)
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} employees?`)) return
    try {
      const res = await fetch('/api/admin/employees/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('Failed to bulk delete')
      toast.success(`Deleted ${selectedIds.size} employees`)
      setSelectedIds(new Set())
      fetchEmployees()
    } catch {
      toast.error('Failed to bulk delete')
    }
  }

  const query = search.trim().toLowerCase()

  const wordScore = (val: string | null, q: string): number => {
    const v = (val ?? '').toLowerCase()
    if (!v || !q) return 0
    const words = v.split(/[\s\-_./@]+/)
    if (words.some(w => w === q)) return 3
    if (words.some(w => w.startsWith(q))) return 2
    if (words.some(w => w.includes(q))) return 1
    if (v.includes(q)) return 1
    return 0
  }

  const hasDateFilter = Object.values(dateFilters).some(r => r.start || r.end)

  const filtered = useMemo(() => {
    const base = employees.filter(e => e.role === 'employee')
    const hasSearch = !!query
    if (!hasSearch && !hasDateFilter) return base
    return base.filter(e => {
      if (!inRange(e.joining_date, dateFilters.joining_date)) return false
      if (!hasSearch) return true
      const score = Math.max(
        wordScore(e.full_name, query),
        wordScore(e.email, query),
        wordScore(e.employee_id, query),
        wordScore(e.contact, query),
        wordScore(e.designation, query),
        wordScore(e.joining_date, query),
      )
      return score > 0
    })
  }, [employees, query, dateFilters, hasDateFilter])

  const sorted = useMemo(() => {
    if (!query) return filtered
    const scored = filtered.map(e => {
      const score = Math.max(
        wordScore(e.full_name, query),
        wordScore(e.email, query),
        wordScore(e.employee_id, query),
        wordScore(e.contact, query),
        wordScore(e.designation, query),
        wordScore(e.joining_date, query),
      )
      return { emp: e, score }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.map(x => x.emp)
  }, [filtered, query])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader title="Employee Management" subtitle="Manage all employee records">
        <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          + Add Employee
        </button>
      </PageHeader>

      <div className="shrink-0 space-y-4 mb-4">

      {successMessage && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">
          {successMessage}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input type="text" placeholder="Search by name, email, ID, contact, or designation..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors text-lg leading-none">&times;</button>
          )}
        </div>
        {search && (
          <span className="text-xs text-[#71717a] whitespace-nowrap">{sorted.length} result{sorted.length !== 1 ? 's' : ''}</span>
        )}
        {hasDateFilter && (
          <button onClick={() => { setDateFilters({ joining_date: { start: '', end: '' } }); setActiveDateFilter(null) }}
            className="text-xs text-[#71717a] hover:text-red-400 transition-colors px-2">
            Clear all date filters
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
          <span className="text-sm text-[#a1a1aa]">{selectedIds.size} selected</span>
          <button onClick={() => {
            if (selectedIds.size === 1) {
              const id = Array.from(selectedIds)[0]
              const emp = employees.find(e => e.id === id) || sorted.find(e => e.id === id)
              if (emp) { openModal(emp); setSelectedIds(new Set()); return }
            }
            setBulkForm({ designation: '', contact: '' }); setShowBulkModal(true)
          }} className="text-xs bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/20 px-3 py-1.5 rounded-lg transition-all">Edit Selected</button>
          <button onClick={handleBulkDelete} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-all">Delete Selected</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#71717a] hover:text-white ml-auto transition-colors">Clear selection</button>
        </div>
      )}
      </div>

      <div className={`flex-1 flex flex-col bg-[#111111] border border-[#2a2a2a] rounded-2xl ${activeDateFilter ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className={`flex-1 ${activeDateFilter ? 'overflow-hidden' : 'overflow-auto'}`}>
          <table className="w-full">
            <thead ref={dateFilterRef} className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#2a2a2a]">
                {['SELECT', 'Employee ID', 'Full Name', 'Email', 'Contact', 'Designation', 'Joining Date', 'Status'].map(h => {
                  if (h === 'SELECT') {
                    return (
                      <th key="select" className="text-left px-2 py-3 w-10">
                        <input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleSelectAll}
                          className="accent-[#22c55e] cursor-pointer" />
                      </th>
                    )
                  }
                  const dateKey = DATE_COLUMNS[h]
                  const isActive = activeDateFilter === dateKey
                  const hasFilter = dateKey && !!(dateFilters[dateKey as keyof typeof dateFilters]?.start || dateFilters[dateKey as keyof typeof dateFilters]?.end)
                  return (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap relative">
                      {dateKey ? (
                        <div className="flex items-center gap-1.5">
                          <span>{h}</span>
                          <button onClick={(e) => { e.stopPropagation(); setActiveDateFilter(isActive ? null : dateKey) }}
                            className={`p-0.5 rounded transition-colors ${hasFilter ? 'text-[#22c55e]' : 'text-[#3a3a3a] hover:text-[#a1a1aa]'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                        </div>
                      ) : h}
                      {dateKey && isActive && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3.5 z-[9999] shadow-2xl min-w-[260px]" onClick={e => e.stopPropagation()}>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] text-[#71717a] mb-1.5 font-medium">FROM</label>
                              <input type="date" value={dateFilters[dateKey as keyof typeof dateFilters].start}
                                onChange={e => setDateFilters(f => ({ ...f, [dateKey]: { ...f[dateKey as keyof typeof f], start: e.target.value } }))}
                                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22c55e]/60 [color-scheme:dark]" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-[#71717a] mb-1.5 font-medium">TO</label>
                              <input type="date" value={dateFilters[dateKey as keyof typeof dateFilters].end}
                                onChange={e => setDateFilters(f => ({ ...f, [dateKey]: { ...f[dateKey as keyof typeof f], end: e.target.value } }))}
                                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22c55e]/60 [color-scheme:dark]" />
                            </div>
                            <div className="flex gap-2 pt-1">
                              {hasFilter && (
                                <button onClick={() => { setDateFilters(f => ({ ...f, [dateKey]: { start: '', end: '' } })); setActiveDateFilter(null) }}
                                  className="flex-1 text-center text-xs text-[#71717a] hover:text-red-400 py-1.5 rounded-lg border border-[#2a2a2a] hover:border-red-400/30 transition-colors">
                                  Clear
                                </button>
                              )}
                              <button onClick={() => setActiveDateFilter(null)}
                                className="flex-1 text-center text-xs text-white bg-[#22c55e]/20 hover:bg-[#22c55e]/30 py-1.5 rounded-lg border border-[#22c55e]/40 transition-colors">
                                Apply
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#71717a] text-sm">No employees found.</td></tr>
              ) : (
                sorted.map(emp => (
                  <tr key={emp.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-2 py-3"><input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)} className="accent-[#22c55e] cursor-pointer" /></td>
                    <td className="px-4 py-3 text-sm text-[#22c55e] font-mono">{emp.employee_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{emp.full_name}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{emp.email}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{emp.contact || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{emp.designation || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{formatDate(emp.joining_date)}</td>
                    <td className="px-4 py-3">
                      {emp.email_confirmed_at ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 font-bold uppercase tracking-wider">Verified</span>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-bold uppercase tracking-wider">Unverified</span>
                      )}
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
                { label: 'Joining Date', name: 'joining_date' as const, type: 'date', placeholder: '' },
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

      {/* Bulk Edit Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-1">Bulk Edit ({selectedIds.size} employees)</h2>
            <p className="text-xs text-[#71717a] mb-5">Only filled fields will be updated.</p>
            <div className="space-y-3">
              {[
                { label: 'Designation', name: 'designation', type: 'text' },
                { label: 'Contact', name: 'contact', type: 'text' },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">{f.label}</label>
                  <input type={f.type} value={bulkForm[f.name as keyof typeof bulkForm]} onChange={e => setBulkForm({ ...bulkForm, [f.name]: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBulkModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="button" onClick={handleBulkUpdate} disabled={bulkSaving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {bulkSaving ? 'Updating...' : 'Update All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
