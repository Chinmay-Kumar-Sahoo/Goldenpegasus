'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface CandidateRecord {
  id: string
  owner_id: string
  Candidate_name: string
  Candidate_email: string | null
  client_phone: string | null
  address: string | null
  status: string | null

  notes: string | null
  created_at: string
  employee_name?: string | null
  backup_employee_id?: string | null
  backup_employee_name?: string | null
  technology?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  'active': 'bg-green-500/10 text-green-400 border-green-500/20',
  'inactive': 'bg-red-500/10 text-red-400 border-red-500/20',
  'prospect': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Active': 'bg-green-500/10 text-green-400 border-green-500/20',
  'In-active': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Closed': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const TEXT_FILTER_COLUMNS: Record<string, string> = {
  'Candidate Name': 'Candidate_name',
  'Technology': 'technology',
  'Email': 'Candidate_email',
  'Primary Employee': 'employee_name',
  'Backup Employee': 'backup_employee_name',
}

const SORT_FIELDS: Record<string, string> = {
  ...TEXT_FILTER_COLUMNS,
  'Phone': 'client_phone',
  'Status': 'status',
}

const PAGE_SIZES = [25, 50, 100] as const

function wordScore(val: string | null | undefined, q: string): number {
  const v = (val ?? '').toLowerCase()
  if (!v || !q) return 0
  const words = v.split(/[\s\-_./@]+/)
  if (words.some(w => w === q)) return 3
  if (words.some(w => w.startsWith(q))) return 2
  if (words.some(w => w.includes(q))) return 1
  if (v.includes(q)) return 1
  return 0
}

const TableRow = memo(function TableRow({
  rec, readOnly, selectedIds, toggleSelect
}: {
  rec: CandidateRecord
  readOnly: boolean
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
}) {
  return (
    <tr className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
      {!readOnly && <td className="px-2 py-3"><input type="checkbox" checked={selectedIds.has(rec.id)} onChange={() => toggleSelect(rec.id)} className="accent-[#22c55e] cursor-pointer" /></td>}
      <td className="px-4 py-3 text-sm text-white font-medium">{rec.Candidate_name}</td>
      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.technology || '—'}</td>
      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.Candidate_email || '—'}</td>
      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.client_phone || '—'}</td>
      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.employee_name || '—'}</td>
      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.backup_employee_name || '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[rec.status || 'Active'] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
          {rec.status || 'Active'}
        </span>
      </td>

    </tr>
  )
})

export default function CandidatesPage({ isAdmin = false, readOnly = false, initialRecords = [], employeeOptions = [], initialOwnerNames = {}, currentUserId: propUserId = null }: { isAdmin?: boolean; readOnly?: boolean; initialRecords?: CandidateRecord[]; employeeOptions?: Array<{ id: string; full_name: string }>; initialOwnerNames?: Record<string, string>; currentUserId?: string | null }) {
  const [records, setRecords] = useState<CandidateRecord[]>(() =>
    initialRecords.map(r => ({
      ...r,
      employee_name: (r.employee_name || initialOwnerNames[r.owner_id] || null),
      backup_employee_name: (r.backup_employee_name || (r.backup_employee_id ? initialOwnerNames[r.backup_employee_id] : null) || null),
    }))
  )
  const [loading, setLoading] = useState(initialRecords.length === 0)
  const currentUserIdRef = useRef(propUserId)
  const initialOwnerNamesRef = useRef(initialOwnerNames)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CandidateRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ Candidate_name: '', Candidate_email: '', client_phone: '', address: '', status: 'Active', notes: '', employee_name: '', backup_employee_id: '', backup_employee_name: '', technology: '' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState({ status: '', notes: '', address: '' })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [activeTextFilter, setActiveTextFilter] = useState<string | null>(null)
  const [textFilters, setTextFilters] = useState<Record<string, string[]>>({})
  const [textFilterSearch, setTextFilterSearch] = useState('')
  const [sortBy, setSortBy] = useState('Candidate Name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(50)
  const tableRef = useRef<HTMLDivElement | null>(null)

  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const fetchingRef = useRef(false)
  const fetchedRef = useRef(false)
  const toastRef = useRef(toast)

  useEffect(() => { currentUserIdRef.current = propUserId }, [propUserId])
  useEffect(() => { initialOwnerNamesRef.current = initialOwnerNames }, [initialOwnerNames])

  const fetchRecords = useCallback(async (background = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (!background) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (!isAdmin && !readOnly && currentUserIdRef.current)
        params.set('owner_id', currentUserIdRef.current)
      const qs = params.toString()
      const url = `/api/candidates${qs ? '?' + qs : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      const ownerNames = initialOwnerNamesRef.current
      setRecords((json.records || []).map((r: any) => ({ ...r, employee_name: r.employee_name || ownerNames[r.owner_id] || null, backup_employee_name: r.backup_employee_name || (r.backup_employee_id ? ownerNames[r.backup_employee_id] : null) || null })))
      setPage(0)
    } catch (err: any) {
      toastRef.current.error('Failed to load candidates')
    } finally {
      if (!background) setLoading(false)
      fetchingRef.current = false
    }
  }, [isAdmin, readOnly])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      if (initialRecords.length === 0) fetchRecords()
    }
  }, [fetchRecords])

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(0)
    }, 300)
  }, [])

  useEffect(() => {
    return () => clearTimeout(searchDebounceRef.current)
  }, [])

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
    if (!activeTextFilter) return
    const handleClick = (e: MouseEvent) => {
      setActiveTextFilter(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [activeTextFilter])

  const openModal = (rec?: CandidateRecord) => {
    if (rec) {
      setEditing(rec)
      setForm({ Candidate_name: rec.Candidate_name, Candidate_email: rec.Candidate_email || '', client_phone: rec.client_phone || '', address: rec.address || '', status: rec.status || 'Active', notes: rec.notes || '', employee_name: rec.employee_name || '', backup_employee_id: rec.backup_employee_id || '', backup_employee_name: rec.backup_employee_name || '', technology: rec.technology || '' })
      setSelectedEmployeeId(rec.owner_id || '')
    } else {
      setEditing(null)
      setForm({ Candidate_name: '', Candidate_email: '', client_phone: '', address: '', status: 'Active', notes: '', employee_name: '', backup_employee_id: '', backup_employee_name: '', technology: '' })
      setSelectedEmployeeId('')
    }
    setError('')
    setShowModal(true)
  }

  const handleSort = (header: string) => {
    if (sortBy === header) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(header)
      setSortDir('asc')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (form.Candidate_email && !emailRe.test(form.Candidate_email)) { setError('Invalid email format'); return }
    if (form.client_phone) {
      if (/\D/.test(form.client_phone)) { setError('Phone must contain only digits'); return }
      if (form.client_phone.length !== 10) { setError('Phone must be exactly 10 digits'); return }
    }
    setSaving(true)
    const cleanForm = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]))
    const payload = editing
      ? { ...cleanForm, id: editing.id, ...(isAdmin && selectedEmployeeId ? { selectedEmployeeId } : {}), ...(form.backup_employee_id ? { backupEmployeeId: form.backup_employee_id } : {}) }
      : { ...cleanForm, Candidate_name: form.Candidate_name, ...(isAdmin && selectedEmployeeId ? { selectedEmployeeId } : {}), ...(form.backup_employee_id ? { backupEmployeeId: form.backup_employee_id } : {}) }
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
      toast.error(err.message || 'Failed to save candidate')
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
      setBulkForm({ status: '', notes: '', address: '' })
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
    const headers = ['Candidate Name', 'Technology', 'Email', 'Phone', 'Primary Employee', 'Backup Employee', 'Notes']
    const rows = filtered.map(r => [r.Candidate_name, r.technology || '', r.Candidate_email, r.client_phone, r.employee_name, r.backup_employee_name, r.notes])
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

    const headers = ['Candidate Name', 'Technology', 'Email', 'Phone', 'Primary Employee', 'Backup Employee', 'Notes']
    const data = filtered.map(r => [r.Candidate_name, r.technology || '', r.Candidate_email || '', r.client_phone || '', r.employee_name || '', r.backup_employee_name || '', r.notes || ''])

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

  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const [header, fieldKey] of Object.entries(TEXT_FILTER_COLUMNS)) {
      const seen = new Set<string>()
      const values: string[] = []
      for (const rec of records) {
        const val = (rec as any)[fieldKey]
        if (val == null || val === '') continue
        const key = String(val).trim().toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          values.push(String(val).trim())
        }
      }
      result[header] = values.sort((a, b) => a.localeCompare(b))
    }
    return result
  }, [records])

  const hasTextFilter = Object.values(textFilters).some(v => v.length > 0)

  const filtered = useMemo(() => {
    const hasSearch = !!query
    if (!hasSearch && !hasTextFilter) return records
    return records.filter(r => {
      for (const [header, selected] of Object.entries(textFilters)) {
        if (selected.length === 0) continue
        const fieldKey = TEXT_FILTER_COLUMNS[header]
        const fieldVal = String((r as any)[fieldKey] ?? '').trim().toLowerCase()
        if (!selected.some(s => s.toLowerCase() === fieldVal)) return false
      }
      if (!hasSearch) return true
      return         wordScore(r.Candidate_name, query) > 0 ||
        wordScore(r.technology, query) > 0 ||
        wordScore(r.Candidate_email, query) > 0 ||
        wordScore(r.client_phone, query) > 0 ||
        wordScore(r.employee_name, query) > 0 ||
        wordScore(r.backup_employee_name, query) > 0 ||
        wordScore(r.address, query) > 0 ||
        wordScore(r.notes, query) > 0
    })
  }, [records, query, textFilters, hasTextFilter])

  const sorted = useMemo(() => {
    const fieldKey = SORT_FIELDS[sortBy]
    let result: CandidateRecord[]
    if (query) {
      const scored = filtered.map(r => {
        const score = Math.max(
          wordScore(r.Candidate_name, query),
          wordScore(r.technology, query),
          wordScore(r.Candidate_email, query),
          wordScore(r.client_phone, query),
          wordScore(r.employee_name, query),
          wordScore(r.backup_employee_name, query),
          wordScore(r.address, query),
          wordScore(r.notes, query),
        )
        return { rec: r, score }
      })
      scored.sort((a, b) => b.score - a.score)
      result = scored.map(x => x.rec)
    } else {
      result = [...filtered]
    }
    if (fieldKey) {
      result.sort((a, b) => {
        const aVal = (a as any)[fieldKey]
        const bVal = (b as any)[fieldKey]
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        const cmp = typeof aVal === 'string' && typeof bVal === 'string'
          ? aVal.toLowerCase().localeCompare(bVal.toLowerCase())
          : String(aVal).localeCompare(String(bVal))
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }, [filtered, query, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = useMemo(() => {
    const start = page * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(0)
  }, [page, totalPages])

  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Scroll to top of table on page change
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [page])

  const anyFilterActive = hasTextFilter || !!searchInput

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader title={isAdmin || readOnly ? 'All Marketing Profiles' : 'My Marketing Profile'} subtitle={readOnly ? 'Read-only view of all marketing profiles' : 'Manage Marketing Profiles'}>
        {!readOnly && <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">+ Add Candidate</button>}
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
          <input type="text" placeholder="Search candidates..." value={searchInput} onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60" />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(0) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors text-lg leading-none">&times;</button>
          )}
        </div>
        {searchInput && (
          <span className="text-xs text-[#71717a] whitespace-nowrap">{sorted.length} result{sorted.length !== 1 ? 's' : ''}</span>
        )}
        {anyFilterActive && (
          <button onClick={() => { setTextFilters({}); setActiveTextFilter(null); setSearchInput(''); setSearch('') }}
            className="text-xs text-[#71717a] hover:text-red-400 transition-colors px-2">
            Clear all filters
          </button>
        )}
      </div>

      {!readOnly && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
          <span className="text-sm text-[#a1a1aa]">{selectedIds.size} selected</span>
          <button onClick={() => {
            if (selectedIds.size === 1) {
              const id = Array.from(selectedIds)[0]
              const rec = records.find(r => r.id === id) || sorted.find(r => r.id === id)
              if (rec) { openModal(rec); setSelectedIds(new Set()); return }
            }
            setBulkForm({ status: '', notes: '', address: '' }); setShowBulkModal(true)
          }} className="text-xs bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/20 px-3 py-1.5 rounded-lg transition-all">Edit Selected</button>
          {isAdmin && <button onClick={handleBulkDelete} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-all">Delete Selected</button>}
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#71717a] hover:text-white ml-auto transition-colors">Clear selection</button>
        </div>
      )}
      </div>

      <div ref={tableRef} className={`flex-1 flex flex-col bg-[#111111] border border-[#2a2a2a] rounded-2xl ${activeTextFilter ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div ref={scrollRef} className={`flex-1 ${activeTextFilter ? 'overflow-hidden' : 'overflow-auto'}`}>
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#2a2a2a]">
                {[...(!readOnly ? ['SELECT'] : []), 'Candidate Name', 'Technology', 'Email', 'Phone', 'Primary Employee', 'Backup Employee', 'Status'].map(h => {
                  if (h === 'SELECT') {
                    return (
                      <th key="select" className="text-left px-2 py-3 w-10">
                        <input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleSelectAll}
                          className="accent-[#22c55e] cursor-pointer" />
                      </th>
                    )
                  }
                  const textKey = TEXT_FILTER_COLUMNS[h]
                  const textIsActive = textKey && activeTextFilter === h
                  const textHasFilter = textKey && (textFilters[h]?.length ?? 0) > 0
                  const sortFieldKey = SORT_FIELDS[h]
                  return (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap relative">
                      <div className="flex items-center gap-1.5">
                        {sortFieldKey ? (
                          <button onClick={() => handleSort(h)} className="flex items-center gap-1 hover:text-white transition-colors">
                            <span>{h}</span>
                            {sortBy === h && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {sortDir === 'asc' ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                )}
                              </svg>
                            )}
                          </button>
                        ) : (
                          <span>{h}</span>
                        )}
                        {textKey && (
                          <button onClick={(e) => { e.stopPropagation(); setActiveTextFilter(textIsActive ? null : h) }}
                            className={`p-0.5 rounded transition-colors ${textHasFilter ? 'text-[#22c55e]' : 'text-[#3a3a3a] hover:text-[#a1a1aa]'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {textKey && textIsActive && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl z-[9999] shadow-2xl min-w-[240px]" onClick={e => e.stopPropagation()}>
                          <div className="p-3.5 space-y-2">
                            <input type="text" value={textFilterSearch} placeholder={`Search ${h}...`} autoFocus
                              onChange={e => setTextFilterSearch(e.target.value)}
                              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22c55e]/60 placeholder-[#3a3a3a]" />
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {(uniqueValues[h] || []).filter(v => !textFilterSearch || v.toLowerCase().includes(textFilterSearch.toLowerCase())).map(v => {
                                const checked = (textFilters[h] || []).includes(v)
                                return (
                                  <label key={v} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2a2a2a] rounded-lg cursor-pointer transition-colors">
                                    <input type="checkbox" checked={checked}
                                      onChange={() => setTextFilters(f => {
                                        const current = f[h] || [];
                                        const next = checked ? current.filter(x => x !== v) : [...current, v];
                                        return { ...f, [h]: next };
                                      })}
                                      className="accent-[#22c55e] cursor-pointer" />
                                    <span className="text-xs text-white truncate">{v}</span>
                                  </label>
                                )
                              })}
                              {(uniqueValues[h] || []).length === 0 && <div className="text-xs text-[#71717a] px-2 py-1">No values available</div>}
                            </div>
                            <div className="flex gap-2 pt-1 border-t border-[#2a2a2a]">
                              <button onClick={() => { setTextFilters(f => ({ ...f, [h]: uniqueValues[h] || [] })); setTextFilterSearch('') }}
                                className="flex-1 text-center text-xs text-white bg-[#22c55e]/20 hover:bg-[#22c55e]/30 py-1.5 rounded-lg border border-[#22c55e]/40 transition-colors">
                                Select All
                              </button>
                              <button onClick={() => { setTextFilters(f => ({ ...f, [h]: [] })); setTextFilterSearch('') }}
                                className="flex-1 text-center text-xs text-[#71717a] hover:text-red-400 py-1.5 rounded-lg border border-[#2a2a2a] hover:border-red-400/30 transition-colors">
                                Clear
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
                    {Array.from({ length: readOnly ? 7 : 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr><td colSpan={readOnly ? 7 : 8} className="px-4 py-12 text-center text-[#71717a] text-sm">No candidate records found.</td></tr>
              ) : (
                paginated.map(rec => (
                  <TableRow key={rec.id} rec={rec} readOnly={readOnly} selectedIds={selectedIds} toggleSelect={toggleSelect} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#2a2a2a] flex items-center justify-between text-xs text-[#71717a]">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#22c55e]/60">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>per page</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Showing {(page * pageSize) + 1}-{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length} records</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2 py-1 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Prev
              </button>
              <span className="px-2 text-white">{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">{editing ? 'Edit Candidate' : 'Add Candidate'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              {/* Primary Employee */}
              {!editing && isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Primary Employee *</label>
                  <select value={selectedEmployeeId} onChange={e => {
                    setSelectedEmployeeId(e.target.value)
                  }} required
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                    <option value="">Select Employee</option>
                    {employeeOptions.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
              {!editing && !isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Primary Employee *</label>
                  <input type="text" value={employeeOptions.find(e => e.id === currentUserIdRef.current)?.full_name || 'You'} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white opacity-50 cursor-not-allowed" />
                </div>
              )}
              {editing && (
                <div>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Primary Employee</label>
                  {isAdmin ? (
                    <select value={selectedEmployeeId || editing.owner_id} onChange={e => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                      {employeeOptions.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={form.employee_name || editing.employee_name || 'You'} disabled
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white opacity-50 cursor-not-allowed" />
                  )}
                </div>
              )}

              {/* Backup Employee */}
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Backup Employee</label>
                <select value={form.backup_employee_id} onChange={e => {
                  const empId = e.target.value
                  const emp = employeeOptions.find(e => e.id === empId)
                  setForm({ ...form, backup_employee_id: empId, backup_employee_name: emp?.full_name || '' })
                }}
                  disabled={!!editing && !isAdmin}
                  className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 ${(!!editing && !isAdmin) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <option value="">No Backup Employee</option>
                  {employeeOptions.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
                {!!editing && !isAdmin && <p className="text-[10px] text-[#71717a] mt-1">Only admin can change backup employee</p>}
              </div>
              {[
                { label: 'Candidate Name *', name: 'Candidate_name', type: 'text', required: true },
                { label: 'Technology', name: 'technology', type: 'text' },
                { label: 'Email', name: 'Candidate_email', type: 'email' },
                { label: 'Phone', name: 'client_phone', type: 'text', inputMode: 'numeric' as const },
                { label: 'Address', name: 'address', type: 'text' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">{field.label}</label>
                  <input type={field.type} inputMode={(field as any).inputMode || 'text'} value={form[field.name as keyof typeof form] || ''} onChange={e => setForm({ ...form, [field.name]: e.target.value })} required={field.required}
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
                <button type="button" onClick={() => { setError(''); setShowModal(false) }} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
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
