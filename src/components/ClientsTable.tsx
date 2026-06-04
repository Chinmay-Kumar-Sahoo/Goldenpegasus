'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface CandidateRecord {
  id: string
  owner_id: string
  Candidate_name: string
  Candidate_email: string | null
  client_phone: string | null
  company_name: string | null
  address: string | null
  status: string | null
  contract_start: string | null
  contract_end: string | null
  project_type: string | null
  notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  'active': 'bg-green-500/10 text-green-400 border-green-500/20',
  'inactive': 'bg-red-500/10 text-red-400 border-red-500/20',
  'prospect': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Active': 'bg-green-500/10 text-green-400 border-green-500/20',
  'In-active': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Closed': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const DATE_COLUMNS: Record<string, string> = {
  'Contract Start': 'contract_start',
  'Contract End': 'contract_end',
}

function inRange(val: string | null, range: { start: string; end: string }): boolean {
  if (!range.start && !range.end) return true
  const d = (val || '').split('T')[0]
  if (!d) return false
  if (range.start && d < range.start) return false
  if (range.end && d > range.end) return false
  return true
}

function wordScore(val: string | null, q: string): number {
  const v = (val ?? '').toLowerCase()
  if (!v || !q) return 0
  const words = v.split(/[\s\-_./@]+/)
  if (words.some(w => w === q)) return 3
  if (words.some(w => w.startsWith(q))) return 2
  if (words.some(w => w.includes(q))) return 1
  if (v.includes(q)) return 1
  return 0
}

export default function CandidatesPage({ isAdmin = false, initialRecords = [] }: { isAdmin?: boolean; initialRecords?: CandidateRecord[] }) {
  const [records, setRecords] = useState<CandidateRecord[]>(initialRecords)
  const [loading, setLoading] = useState(initialRecords.length === 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CandidateRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ Candidate_name: '', Candidate_email: '', client_phone: '', company_name: '', address: '', status: 'Active', contract_start: '', contract_end: '', project_type: '', notes: '' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState({ status: '', notes: '', project_type: '', company_name: '', address: '' })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null)
  const [dateFilters, setDateFilters] = useState({
    contract_start: { start: '', end: '' },
    contract_end: { start: '', end: '' },
  })

  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const dateFilterRef = useRef<HTMLTableSectionElement>(null)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/candidates')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setRecords(json.records || [])
    } catch (err: any) {
      toast.error('Failed to load candidates')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchedRef = useRef(initialRecords.length > 0)

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchRecords()
    }
  }, [fetchRecords])

  useEffect(() => {
    if (!showExportMenu) return
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showExportMenu])

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

  const openModal = (rec?: CandidateRecord) => {
    if (rec) {
      setEditing(rec)
      setForm({ Candidate_name: rec.Candidate_name, Candidate_email: rec.Candidate_email || '', client_phone: rec.client_phone || '', company_name: rec.company_name || '', address: rec.address || '', status: rec.status || 'active', contract_start: rec.contract_start || '', contract_end: rec.contract_end || '', project_type: rec.project_type || '', notes: rec.notes || '' })
    } else {
      setEditing(null)
      setForm({ Candidate_name: '', Candidate_email: '', client_phone: '', company_name: '', address: '', status: 'Active', contract_start: '', contract_end: '', project_type: '', notes: '' })
    }
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const cleanForm = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]))
    const payload = editing ? { ...cleanForm, id: editing.id } : { ...cleanForm, Candidate_name: form.Candidate_name }
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { throw new Error(json.error || 'Failed to save') }
      toast.success(editing ? 'Candidate updated successfully' : 'Candidate added successfully')
      setSaving(false)
      setShowModal(false)
      fetchRecords()
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
      toast.error('Failed to save candidate')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this candidate record?')) return
    try {
      await fetch('/api/candidates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      toast.success('Candidate deleted')
      fetchRecords()
    } catch {
      toast.error('Failed to delete candidate')
    }
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
      const res = await fetch('/api/candidates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates }),
      })
      if (!res.ok) throw new Error('Failed to bulk update')
      toast.success(`Updated ${selectedIds.size} records`)
      setShowBulkModal(false)
      setSelectedIds(new Set())
      setBulkForm({ status: '', notes: '', project_type: '', company_name: '', address: '' })
      fetchRecords()
    } catch {
      toast.error('Failed to bulk update')
    }
    setBulkSaving(false)
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} records?`)) return
    try {
      const res = await fetch('/api/candidates/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('Failed to bulk delete')
      toast.success(`Deleted ${selectedIds.size} records`)
      setSelectedIds(new Set())
      fetchRecords()
    } catch {
      toast.error('Failed to bulk delete')
    }
  }

  const exportCSV = () => {
    const headers = ['Candidate Name', 'Email', 'Phone', 'Company', 'Status', 'Project Type', 'Contract Start', 'Contract End', 'Notes']
    const rows = filtered.map(r => [r.Candidate_name, r.Candidate_email, r.client_phone, r.company_name, r.status, r.project_type, r.contract_start, r.contract_end, r.notes])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'candidate_records.csv'; a.click()
    setShowExportMenu(false)
  }

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape' })

    const headers = ['Candidate Name', 'Email', 'Phone', 'Company', 'Status', 'Project Type', 'Contract Start', 'Contract End', 'Notes']
    const data = filtered.map(r => [r.Candidate_name, r.Candidate_email || '', r.client_phone || '', r.company_name || '', r.status || '', r.project_type || '', r.contract_start || '', r.contract_end || '', r.notes || ''])

    autoTable(doc, {
      head: [headers],
      body: data,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 197, 94] },
    })

    doc.save('candidate_records.pdf')
    setShowExportMenu(false)
  }

  const query = search.trim().toLowerCase()

  const hasDateFilter = Object.values(dateFilters).some(r => r.start || r.end)

  const filtered = useMemo(() => {
    const hasSearch = !!query
    const hasStatus = statusFilter !== 'all'
    if (!hasSearch && !hasStatus && !hasDateFilter) return records
    return records.filter(r => {
      if (hasStatus && r.status !== statusFilter) return false
      if (!inRange(r.contract_start, dateFilters.contract_start)) return false
      if (!inRange(r.contract_end, dateFilters.contract_end)) return false
      if (!hasSearch) return true
      return wordScore(r.Candidate_name, query) > 0 ||
        wordScore(r.company_name, query) > 0 ||
        wordScore(r.Candidate_email, query) > 0 ||
        wordScore(r.client_phone, query) > 0 ||
        wordScore(r.project_type, query) > 0 ||
        wordScore(r.address, query) > 0 ||
        wordScore(r.notes, query) > 0 ||
        wordScore(r.contract_start, query) > 0 ||
        wordScore(r.contract_end, query) > 0
    })
  }, [records, query, statusFilter, dateFilters, hasDateFilter])

  const sorted = useMemo(() => {
    if (!query) return filtered
    const scored = filtered.map(r => {
      const score = Math.max(
        wordScore(r.Candidate_name, query),
        wordScore(r.company_name, query),
        wordScore(r.Candidate_email, query),
        wordScore(r.client_phone, query),
        wordScore(r.project_type, query),
        wordScore(r.address, query),
        wordScore(r.notes, query),
        wordScore(r.contract_start, query),
        wordScore(r.contract_end, query),
      )
      return { rec: r, score }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.map(x => x.rec)
  }, [filtered, query])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader title={isAdmin ? 'All Candidate Records' : 'My Candidates'} subtitle="Manage candidate information">
        <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">+ Add Candidate</button>
        <div ref={exportMenuRef} className="relative">
          <button onClick={() => setShowExportMenu(v => !v)} className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all">
            Export ▾
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden z-50 min-w-[120px] shadow-xl">
              <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#2a2a2a] transition-colors">CSV</button>
              <button onClick={exportPDF} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#2a2a2a] transition-colors">PDF</button>
            </div>
          )}
        </div>
      </PageHeader>

      <div className="shrink-0 space-y-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <input type="text" placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors text-lg leading-none">&times;</button>
          )}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="In-active">In-active</option>
          <option value="Closed">Closed</option>
        </select>
        {search && (
          <span className="text-xs text-[#71717a] whitespace-nowrap">{sorted.length} result{sorted.length !== 1 ? 's' : ''}</span>
        )}
        {hasDateFilter && (
          <button onClick={() => { setDateFilters({ contract_start: { start: '', end: '' }, contract_end: { start: '', end: '' } }); setActiveDateFilter(null) }}
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
              const rec = records.find(r => r.id === id) || sorted.find(r => r.id === id)
              if (rec) { openModal(rec); setSelectedIds(new Set()); return }
            }
            setBulkForm({ status: '', notes: '', project_type: '', company_name: '', address: '' }); setShowBulkModal(true)
          }} className="text-xs bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/20 px-3 py-1.5 rounded-lg transition-all">Edit Selected</button>
          {isAdmin && <button onClick={handleBulkDelete} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-all">Delete Selected</button>}
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#71717a] hover:text-white ml-auto transition-colors">Clear selection</button>
        </div>
      )}
      </div>

      <div className={`flex-1 flex flex-col bg-[#111111] border border-[#2a2a2a] rounded-2xl ${activeDateFilter ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className={`flex-1 ${activeDateFilter ? 'overflow-hidden' : 'overflow-auto'}`}>
          <table className="w-full">
            <thead ref={dateFilterRef} className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#2a2a2a]">
                {['SELECT', 'Candidate Name', 'Email', 'Phone', 'Company', 'Status', 'Project Type', 'Contract Start', 'Contract End'].map(h => {
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
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[#71717a] text-sm">No candidate records found.</td></tr>
              ) : (
                sorted.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-2 py-3"><input type="checkbox" checked={selectedIds.has(rec.id)} onChange={() => toggleSelect(rec.id)} className="accent-[#22c55e] cursor-pointer" /></td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{rec.Candidate_name}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.Candidate_email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.client_phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[rec.status || 'Active'] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {rec.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.project_type || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{(rec.contract_start || '').split('T')[0] || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{(rec.contract_end || '').split('T')[0] || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#2a2a2a] text-xs text-[#71717a]">Showing {sorted.length} of {records.length} records</div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">{editing ? 'Edit Candidate' : 'Add Candidate'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              {[
                { label: 'Candidate Name *', name: 'Candidate_name', type: 'text', required: true },
                { label: 'Email', name: 'Candidate_email', type: 'email' },
                { label: 'Phone', name: 'client_phone', type: 'text' },
                { label: 'Company Name', name: 'company_name', type: 'text' },
                { label: 'Address', name: 'address', type: 'text' },
                { label: 'Project Type', name: 'project_type', type: 'text' },
                { label: 'Contract Start', name: 'contract_start', type: 'date' },
                { label: 'Contract End', name: 'contract_end', type: 'date' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">{field.label}</label>
                  <input type={field.type} value={form[field.name as keyof typeof form] || ''} onChange={e => setForm({ ...form, [field.name]: e.target.value })} required={field.required}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Status *</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} required
                  disabled={!!editing && !isAdmin}
                  className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 ${(!!editing && !isAdmin) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <option value="">Select Status</option>
                  <option value="Active">Active</option>
                  <option value="In-active">In-active</option>
                  <option value="Closed">Closed</option>
                </select>
                {!!editing && !isAdmin && <p className="text-[10px] text-[#71717a] mt-1">Only admin can change status</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 resize-none" />
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
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
            <h2 className="text-lg font-bold text-white mb-1">Bulk Edit ({selectedIds.size} records)</h2>
            <p className="text-xs text-[#71717a] mb-5">Only filled fields will be updated.</p>
            <div className="space-y-3">
              {[
                { label: 'Status', name: 'status', type: 'select', options: ['', 'Active', 'In-active', 'Closed'] },
                { label: 'Notes', name: 'notes', type: 'textarea' },
                { label: 'Project Type', name: 'project_type', type: 'text' },
                { label: 'Company Name', name: 'company_name', type: 'text' },
                { label: 'Address', name: 'address', type: 'text' },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={bulkForm[f.name as keyof typeof bulkForm]} onChange={e => setBulkForm({ ...bulkForm, [f.name]: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                      {f.options?.map(o => <option key={o} value={o}>{o || '— No change —'}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea value={bulkForm[f.name as keyof typeof bulkForm] || ''} onChange={e => setBulkForm({ ...bulkForm, [f.name]: e.target.value })} rows={2}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 resize-none" />
                  ) : (
                    <input type={f.type} value={bulkForm[f.name as keyof typeof bulkForm] || ''} onChange={e => setBulkForm({ ...bulkForm, [f.name]: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                  )}
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
