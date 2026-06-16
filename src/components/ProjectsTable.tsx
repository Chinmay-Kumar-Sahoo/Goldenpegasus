'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface ProjectRecord {
  id: string
  owner_id: string
  data: Record<string, any>
  created_at: string
  employee_name?: string | null
}

interface CandidateOption {
  name: string
  technology: string | null
}

const FIELD_LABELS: Record<string, string> = {
  candidate_name: 'Candidate Name',
  technology: 'Technology',
  created_date: 'Created Date',
  company_name: 'Company Name',
  project_status: 'Project Status',
  project_type: 'Project Type',
  project_rate: 'Project Rate',
  project_start_date: 'Project Start Date',
  project_end_date: 'Project End Date',
}

const FILTER_FIELDS = ['candidate_name', 'technology', 'company_name', 'project_status', 'project_type', 'created_date', 'project_start_date', 'project_end_date']

const PROJECT_STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled']
const PROJECT_TYPES = ['Full-time', 'Part-time', 'Contract', 'C2H', 'C2C']

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

const TEXT_FILTER_COLUMNS: Record<string, string> = {
  'Candidate Name': 'candidate_name',
  'Technology': 'technology',
  'Company Name': 'company_name',
  'Project Status': 'project_status',
  'Project Type': 'project_type',
}

export default function ProjectsTable({
  currentUserId,
  tableId,
  initialRecords = [],
  candidateOptions = [],
  isAdmin = false,
  readOnly = false,
  title = 'My Project Records',
}: {
  currentUserId?: string | null
  tableId?: string | null
  initialRecords?: ProjectRecord[]
  candidateOptions?: CandidateOption[]
  isAdmin?: boolean
  readOnly?: boolean
  title?: string
}) {
  const [records, setRecords] = useState<ProjectRecord[]>(initialRecords)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [bulkForm, setBulkForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(25)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [activeTextFilter, setActiveTextFilter] = useState<string | null>(null)
  const [textFilters, setTextFilters] = useState<Record<string, string[]>>({})
  const [textFilterSearch, setTextFilterSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCandidateDropdown, setShowCandidateDropdown] = useState(false)

  const fetchedRef = useRef(false)
  const fetchingRef = useRef(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const textFilterRef = useRef<HTMLInputElement>(null)
  const toastRef = useRef(toast)

  const showOwnerColumn = isAdmin || readOnly

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!activeTextFilter) return
    const handleClick = () => setActiveTextFilter(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [activeTextFilter])

  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const f of FILTER_FIELDS) {
      const seen = new Set<string>()
      const values: string[] = []
      for (const rec of records) {
        const val = rec.data?.[f]
        if (val == null || val === '') continue
        const key = String(val).trim().toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          values.push(String(val).trim())
        }
      }
      result[f] = values.sort((a, b) => a.localeCompare(b))
    }
    return result
  }, [records])

  const candidateMap = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const c of candidateOptions) {
      map.set((c.name + '|' + (c.technology || '')).toLowerCase().trim(), c.technology)
    }
    return map
  }, [candidateOptions])

  const fetchRecords = useCallback(async (background = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (!background) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (!readOnly && !isAdmin && currentUserId) params.set('owner_id', currentUserId)
      if (tableId) params.set('table_id', tableId)
      const qs = params.toString()
      const res = await fetch(`/api/projects${qs ? '?' + qs : ''}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setRecords(json.records || [])
      setPage(0)
    } catch {
      toastRef.current.error('Failed to load projects')
    } finally {
      fetchingRef.current = false
      if (!background) setLoading(false)
    }
  }, [currentUserId, tableId, readOnly, isAdmin])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      if (initialRecords.length === 0) fetchRecords()
    }
  }, [fetchRecords, initialRecords.length])

  useEffect(() => {
    return () => clearTimeout(searchDebounceRef.current)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setSearch(value)
      setPage(0)
    }, 300)
  }, [])

  const openModal = (rec?: ProjectRecord) => {
    setError('')
    if (rec) {
      setEditingId(rec.id)
      setForm({ ...rec.data })
    } else {
      setEditingId(null)
      const today = new Date().toISOString().split('T')[0]
      setForm({ created_date: today, project_status: 'Active' })
    }
    setShowModal(true)
  }

  const handleCandidateChange = (candidateName: string, technology?: string | null) => {
    setForm(prev => ({ ...prev, candidate_name: candidateName, technology: technology || '' }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.candidate_name?.trim()) { setError('Candidate Name is required'); return }
    if (!editingId) {
      const dup = records.some(r => String(r.data?.candidate_name ?? '').toLowerCase().trim() === form.candidate_name.toLowerCase().trim())
      if (dup) { setError('A project record for this candidate already exists'); return }
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, data: form, table_id: tableId }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed to save') }
      toastRef.current.success(editingId ? 'Updated' : 'Created')
      setShowModal(false)
      fetchRecords(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleBulkSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const updates: Record<string, string> = {}
    for (const [key, val] of Object.entries(bulkForm)) {
      if (val.trim()) updates[key] = val.trim()
    }
    if (Object.keys(updates).length === 0) { setError('Fill at least one field'); return }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed to bulk update') }
      toastRef.current.success('Records updated')
      setShowBulkModal(false)
      setSelectedIds(new Set())
      setBulkForm({})
      fetchRecords(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSingle = async (id: string) => {
    if (!confirm('Delete this project record?')) return
    try {
      const res = await fetch('/api/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed to delete') }
      toastRef.current.success('Deleted')
      fetchRecords(true)
    } catch (err: any) {
      toastRef.current.error(err.message)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected records?`)) return
    try {
      const res = await fetch('/api/projects/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Failed to delete') }
      toastRef.current.success(`Deleted ${selectedIds.size} records`)
      setSelectedIds(new Set())
      fetchRecords(true)
    } catch (err: any) {
      toastRef.current.error(err.message)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(r => r.id)))
  }

  const hasTextFilter = Object.values(textFilters).some(v => v.length > 0)

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    const hasSearch = !!query
    if (!hasSearch && !hasTextFilter) return records
    return records.filter(r => {
      for (const [field, selected] of Object.entries(textFilters)) {
        if (selected.length === 0) continue
        const val = String(r.data?.[field] ?? '').trim().toLowerCase()
        if (!selected.some(s => s.toLowerCase() === val)) return false
      }
      if (!hasSearch) return true
      const d = r.data || {}
      return Object.keys(d).some(k => wordScore(String(d[k] ?? ''), query) > 0)
    })
  }, [records, query, textFilters, hasTextFilter])

  const sorted = useMemo(() => {
    let result: ProjectRecord[]
    if (query) {
      const scored = filtered.map(r => {
        const d = r.data || {}
        const score = Math.max(...Object.keys(d).map(k => wordScore(String(d[k] ?? ''), query)))
        return { rec: r, score }
      })
      scored.sort((a, b) => b.score - a.score)
      result = scored.map(x => x.rec)
    } else {
      result = [...filtered]
    }
    result.sort((a, b) => {
      let av: string, bv: string
      if (sortField === 'created_at') { av = a.created_at; bv = b.created_at }
      else { av = String(a.data?.[sortField] || ''); bv = String(b.data?.[sortField] || '') }
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [filtered, query, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = useMemo(() => {
    const start = page * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(0)
  }, [page, totalPages])

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const renderFieldValue = (field: string, value: any) => {
    if (!value) return '—'
    if (field === 'created_date' || field === 'project_start_date' || field === 'project_end_date') {
      return new Date(value).toLocaleDateString()
    }
    return String(value)
  }

  const subtitle = isAdmin ? 'View and manage all employee project records' : readOnly ? 'View all project records' : 'Track your project assignments'

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}>
        {!readOnly && (
          <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-lg text-sm transition-all">+ Add Project</button>
        )}
      </PageHeader>

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <input type="text" value={searchInput} onChange={e => handleSearchChange(e.target.value)} placeholder="Search all fields..." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2 pl-9 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-[#71717a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          {(searchInput || hasTextFilter) && (
            <button onClick={() => { setTextFilters({}); setActiveTextFilter(null); setSearchInput(''); setSearch('') }}
              className="text-xs text-[#71717a] hover:text-red-400 transition-colors px-2">
              Clear all filters
            </button>
          )}
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>

        {selectedIds.size > 0 && !readOnly && (
          <div className="flex items-center gap-3 bg-[#1a1a1a] border-b border-[#2a2a2a] px-4 py-2.5">
            <span className="text-sm text-[#a1a1aa]">{selectedIds.size} selected</span>
            <button onClick={() => {
              if (selectedIds.size === 1) {
                const rec = records.find(r => r.id === Array.from(selectedIds)[0]) || sorted.find(r => r.id === Array.from(selectedIds)[0])
                if (rec) { openModal(rec); setSelectedIds(new Set()); return }
              }
              setBulkForm({}); setError(''); setShowBulkModal(true)
            }} className="text-xs bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/20 px-3 py-1.5 rounded-lg transition-all">Edit Selected</button>
            {isAdmin && (
              <button onClick={handleBulkDelete} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-all">Delete Selected</button>
            )}
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#71717a] hover:text-white ml-auto transition-colors">Clear selection</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {!readOnly && (
                  <th className="text-left px-2 py-3 w-10">
                    <input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleSelectAll}
                      className="accent-[#22c55e] cursor-pointer" />
                  </th>
                )}
                {showOwnerColumn && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => toggleSort('employee_name')} className="flex items-center gap-1 hover:text-white transition-colors">
                      <span>Employee</span>
                      {sortField === 'employee_name' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {sortDir === 'asc' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                )}
                {FILTER_FIELDS.map(f => {
                  const label = FIELD_LABELS[f]
                  const textKey = TEXT_FILTER_COLUMNS[label]
                  const textIsActive = textKey && activeTextFilter === f
                  const textHasFilter = textKey && (textFilters[f]?.length ?? 0) > 0
                  return (
                    <th key={f} className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider whitespace-nowrap relative">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleSort(f)} className="flex items-center gap-1 hover:text-white transition-colors">
                          <span>{label}</span>
                          {sortField === f && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              {sortDir === 'asc' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              )}
                            </svg>
                          )}
                        </button>
                        {textKey && (
                          <button onClick={(e) => { e.stopPropagation(); setActiveTextFilter(textIsActive ? null : f); setTextFilterSearch('') }}
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
                            <input type="text" value={textFilterSearch} placeholder={`Search ${label}...`} autoFocus
                              onChange={e => setTextFilterSearch(e.target.value)}
                              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#22c55e]/60 placeholder-[#3a3a3a]" />
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {(uniqueValues[f] || []).filter(v => !textFilterSearch || v.toLowerCase().includes(textFilterSearch.toLowerCase())).map(v => {
                                const checked = (textFilters[f] || []).includes(v)
                                return (
                                  <label key={v} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2a2a2a] rounded-lg cursor-pointer transition-colors">
                                    <input type="checkbox" checked={checked}
                                      onChange={() => setTextFilters(p => {
                                        const current = p[f] || [];
                                        const next = checked ? current.filter(x => x !== v) : [...current, v];
                                        return { ...p, [f]: next };
                                      })}
                                      className="accent-[#22c55e] cursor-pointer" />
                                    <span className="text-xs text-white truncate">{v}</span>
                                  </label>
                                )
                              })}
                              {(uniqueValues[f] || []).length === 0 && <div className="text-xs text-[#71717a] px-2 py-1">No values available</div>}
                            </div>
                            <div className="flex gap-2 pt-1 border-t border-[#2a2a2a]">
                              <button onClick={() => { setTextFilters(p => ({ ...p, [f]: uniqueValues[f] || [] })); setTextFilterSearch('') }}
                                className="flex-1 text-center text-xs text-white bg-[#22c55e]/20 hover:bg-[#22c55e]/30 py-1.5 rounded-lg border border-[#22c55e]/40 transition-colors">
                                Select All
                              </button>
                              <button onClick={() => { setTextFilters(p => ({ ...p, [f]: [] })); setTextFilterSearch('') }}
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
                {!readOnly && <th className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider w-16"><span>Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    <td className="px-4 py-4" colSpan={FILTER_FIELDS.length + (showOwnerColumn ? 1 : 0) + (readOnly ? 0 : 2)}><div className="skeleton h-4 w-full" /></td>
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={FILTER_FIELDS.length + (showOwnerColumn ? 1 : 0) + (readOnly ? 0 : 2)} className="px-4 py-12 text-center text-[#71717a] text-sm">No project records yet.</td></tr>
              ) : (
                paged.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    {!readOnly && (
                      <td className="px-2 py-3">
                        <input type="checkbox" checked={selectedIds.has(rec.id)} onChange={() => toggleSelect(rec.id)} className="accent-[#22c55e] cursor-pointer" />
                      </td>
                    )}
                    {showOwnerColumn && (
                      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.employee_name || '—'}</td>
                    )}
                    {FILTER_FIELDS.map(f => (
                      <td key={f} className="px-4 py-3 text-sm text-[#a1a1aa]">{renderFieldValue(f, rec.data?.[f])}</td>
                    ))}
                    {!readOnly && (
                      <td className="px-4 py-3 text-xs text-[#71717a] flex gap-1">
                        <button onClick={() => openModal(rec)} className="hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-[#2a2a2a]" title="Edit">✎</button>
                        {isAdmin && (
                          <button onClick={() => handleDeleteSingle(rec.id)} className="hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-[#2a2a2a]" title="Delete">✕</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-[#2a2a2a] flex items-center justify-between text-xs text-[#71717a]">
          <span>Showing {paged.length > 0 ? page * pageSize + 1 : 0}-{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} records</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] disabled:opacity-30 transition-colors">← Prev</button>
            <span className="text-[#a1a1aa]">{page + 1} / {totalPages || 1}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-[#2a2a2a] hover:bg-[#1a1a1a] disabled:opacity-30 transition-colors">Next →</button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">{editingId ? 'Edit Project' : 'Add Project'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Candidate Name *</label>
                <div className="relative">
                  <button type="button" onClick={() => setShowCandidateDropdown(!showCandidateDropdown)}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:border-[#22c55e]/60">
                    <span className={form.candidate_name ? 'text-white' : 'text-[#3a3a3a]'}>{form.candidate_name || 'Select candidate...'}</span>
                    <svg className="w-4 h-4 text-[#71717a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showCandidateDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCandidateDropdown(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl z-50 max-h-48 overflow-y-auto shadow-2xl">
                        <div className="px-4 py-1.5 text-[10px] text-[#71717a] border-b border-[#2a2a2a]">{candidateOptions.length} candidate{candidateOptions.length !== 1 ? 's' : ''} available</div>
                        {candidateOptions.map(c => (
                          <button key={c.name + '|' + (c.technology || '')} type="button" onClick={() => { handleCandidateChange(c.name, c.technology); setShowCandidateDropdown(false) }}
                            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-between">
                            <span>{c.name}</span>
                            {c.technology && <span className="text-[10px] text-[#71717a]">{c.technology}</span>}
                          </button>
                        ))}
                        {candidateOptions.length === 0 && (
                          <div className="px-4 py-3 text-xs text-[#71717a]">No candidates assigned to you</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Technology</label>
                <input type="text" value={form.technology || ''} onChange={e => setForm(p => ({ ...p, technology: e.target.value }))} placeholder="Auto-filled from candidate"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Created Date</label>
                <input type="date" value={form.created_date || ''} disabled
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-[#71717a] focus:outline-none cursor-not-allowed opacity-70" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Company Name</label>
                <input type="text" value={form.company_name || ''} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} placeholder="e.g. Tech Mahindra, TCS"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Status</label>
                  <select value={form.project_status || 'Active'} onChange={e => setForm(p => ({ ...p, project_status: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Type</label>
                  <select value={form.project_type || ''} onChange={e => setForm(p => ({ ...p, project_type: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                    <option value="">Select type</option>
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Rate</label>
                <input type="text" value={form.project_rate || ''} onChange={e => setForm(p => ({ ...p, project_rate: e.target.value }))} placeholder="e.g. $60/hr"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Start Date</label>
                  <input type="date" value={form.project_start_date || ''} onChange={e => setForm(p => ({ ...p, project_start_date: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project End Date</label>
                  <input type="date" value={form.project_end_date || ''} onChange={e => setForm(p => ({ ...p, project_end_date: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                </div>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">{saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-2">Bulk Edit ({selectedIds.size} records)</h2>
            <p className="text-xs text-[#71717a] mb-6">Only filled fields will be updated.</p>
            <form onSubmit={handleBulkSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Company Name</label>
                <input type="text" value={bulkForm.company_name || ''} onChange={e => setBulkForm(p => ({ ...p, company_name: e.target.value }))} placeholder="Leave blank to keep current"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Status</label>
                  <select value={bulkForm.project_status || ''} onChange={e => setBulkForm(p => ({ ...p, project_status: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                    <option value="">No change</option>
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Type</label>
                  <select value={bulkForm.project_type || ''} onChange={e => setBulkForm(p => ({ ...p, project_type: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                    <option value="">No change</option>
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Rate</label>
                <input type="text" value={bulkForm.project_rate || ''} onChange={e => setBulkForm(p => ({ ...p, project_rate: e.target.value }))} placeholder="Leave blank to keep current"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project Start Date</label>
                  <input type="date" value={bulkForm.project_start_date || ''} onChange={e => setBulkForm(p => ({ ...p, project_start_date: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Project End Date</label>
                  <input type="date" value={bulkForm.project_end_date || ''} onChange={e => setBulkForm(p => ({ ...p, project_end_date: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                </div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBulkModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">{saving ? 'Saving...' : 'Update All'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
