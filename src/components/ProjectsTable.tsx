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

const TEXT_FILTER_COLUMNS: Record<string, string> = {
  'Candidate Name': 'candidate_name',
  'Technology': 'technology',
  'Company Name': 'company_name',
  'Project Status': 'project_status',
  'Project Type': 'project_type',
}

export default function ProjectsTable({
  currentUserId,
  initialRecords = [],
  candidateOptions = [],
}: {
  currentUserId?: string | null
  initialRecords?: ProjectRecord[]
  candidateOptions?: CandidateOption[]
}) {
  const [records, setRecords] = useState<ProjectRecord[]>(initialRecords)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(25)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [activeTextFilter, setActiveTextFilter] = useState<string | null>(null)
  const [textFilters, setTextFilters] = useState<Record<string, string>>({})

  const fetchedRef = useRef(false)
  const fetchingRef = useRef(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const textFilterRef = useRef<HTMLInputElement>(null)
  const toastRef = useRef(toast)

  const candidateMap = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const c of candidateOptions) {
      if (!map.has(c.name.toLowerCase().trim())) map.set(c.name.toLowerCase().trim(), c.technology)
    }
    return map
  }, [candidateOptions])

  const fetchRecords = useCallback(async (background = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (!background) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (currentUserId) params.set('owner_id', currentUserId)
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
  }, [currentUserId])

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

  const handleCandidateChange = (candidateName: string) => {
    const key = candidateName.toLowerCase().trim()
    const tech = candidateMap.get(key) || ''
    setForm(prev => ({ ...prev, candidate_name: candidateName, technology: tech }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.candidate_name?.trim()) { setError('Candidate Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, data: form }),
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project record?')) return
    try {
      const res = await fetch('/api/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      toastRef.current.success('Deleted')
      fetchRecords(true)
    } catch {
      toastRef.current.error('Failed to delete')
    }
  }

  const filtered = useMemo(() => {
    let result = [...records]
    const q = search.toLowerCase().trim()
    if (q) {
      result = result.filter(r => {
        const d = r.data || {}
        return Object.values(d).some(v => String(v || '').toLowerCase().includes(q))
      })
    }
    for (const [field, val] of Object.entries(textFilters)) {
      if (!val) continue
      const fv = val.toLowerCase().trim()
      result = result.filter(r => String(r.data?.[field] || '').toLowerCase().includes(fv))
    }
    const sf = sortField === 'created_at' ? 'created_at' : `data.${sortField}`
    result.sort((a, b) => {
      let av: string, bv: string
      if (sortField === 'created_at') { av = a.created_at; bv = b.created_at }
      else { av = String(a.data?.[sortField] || ''); bv = String(b.data?.[sortField] || '') }
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [records, search, textFilters, sortField, sortDir])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="text-[#3a3a3a] ml-1">↕</span>
    return <span className="text-[#22c55e] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const renderFieldValue = (field: string, value: any) => {
    if (!value) return '—'
    if (field === 'created_date' || field === 'project_start_date' || field === 'project_end_date') {
      return new Date(value).toLocaleDateString()
    }
    return String(value)
  }

  return (
    <div>
      <PageHeader title="My Project Records" subtitle="Track your project assignments">
        <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-lg text-sm transition-all">+ Add Project</button>
      </PageHeader>

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <input type="text" value={searchInput} onChange={e => handleSearchChange(e.target.value)} placeholder="Search all fields..." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2 pl-9 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-[#71717a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <span>Actions</span>
                  </div>
                </th>
                {FILTER_FIELDS.map(f => (
                  <th key={f} className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => toggleSort(f)} className="flex items-center gap-1 hover:text-white transition-colors">
                        <span>{FIELD_LABELS[f]}</span>
                        <SortIcon field={f} />
                      </button>
                      {TEXT_FILTER_COLUMNS[FIELD_LABELS[f]] && (
                        <div className="relative">
                          <input type="text" value={textFilters[f] || ''} onChange={e => { setTextFilters(p => ({ ...p, [f]: e.target.value })); setPage(0) }} placeholder="Filter..." className="w-24 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-[#22c55e]/60" />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    <td className="px-4 py-4" colSpan={FILTER_FIELDS.length + 1}><div className="skeleton h-4 w-full" /></td>
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={FILTER_FIELDS.length + 1} className="px-4 py-12 text-center text-[#71717a] text-sm">No project records yet.</td></tr>
              ) : (
                paged.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#71717a]">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openModal(rec)} className="hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-[#2a2a2a]">✎</button>
                        <button onClick={() => handleDelete(rec.id)} className="hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-[#2a2a2a]">✕</button>
                      </div>
                    </td>
                    {FILTER_FIELDS.map(f => (
                      <td key={f} className="px-4 py-3 text-sm text-[#a1a1aa]">{renderFieldValue(f, rec.data?.[f])}</td>
                    ))}
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
                  <input type="text" value={form.candidate_name || ''} onChange={e => handleCandidateChange(e.target.value)} list="candidate-list" required placeholder="Type or select candidate..." autoComplete="off"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                  <datalist id="candidate-list">
                    {candidateOptions.map(c => (
                      <option key={c.name + '|' + (c.technology || '')} value={c.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Technology</label>
                <input type="text" value={form.technology || ''} onChange={e => setForm(p => ({ ...p, technology: e.target.value }))} placeholder="Auto-filled from candidate"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Created Date</label>
                <input type="date" value={form.created_date || ''} onChange={e => setForm(p => ({ ...p, created_date: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
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
    </div>
  )
}
