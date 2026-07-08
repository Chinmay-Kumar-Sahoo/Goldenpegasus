'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface ProjectRecord {
  id: string
  owner_id: string
  data: Record<string, any>
  created_at: string
}

const PAGE_SIZES = [25, 50, 100] as const

export default function ProjectsTable({
  currentUserId,
  tableId,
  initialRecords = [],
  isAdmin = false,
  readOnly = false,
  title = 'My Project Records',
}: {
  currentUserId?: string | null
  tableId?: string | null
  initialRecords?: ProjectRecord[]
  isAdmin?: boolean
  readOnly?: boolean
  title?: string
}) {
  const [records, setRecords] = useState<ProjectRecord[]>(initialRecords)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formContent, setFormContent] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(25)

  const fetchedRef = useRef(false)
  const fetchingRef = useRef(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const toastRef = useRef(toast)

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
      setFormContent(rec.data?.content || '')
    } else {
      setEditingId(null)
      setFormContent('')
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, data: { content: formContent }, table_id: tableId }),
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
    if (!confirm('Delete this record?')) return
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

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!query) return records
    return records.filter(r => {
      const content = String(r.data?.content || '').toLowerCase()
      return content.includes(query)
    })
  }, [records, query])

  const sorted = useMemo(() => {
    const result = [...filtered]
    result.sort((a, b) => {
      const cmp = (b.created_at || '').localeCompare(a.created_at || '')
      return cmp
    })
    return result
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = useMemo(() => {
    const start = page * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(0)
  }, [page, totalPages])

  const subtitle = isAdmin ? 'View and manage all records' : readOnly ? 'View all records' : 'Manage your records'

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}>
        {!readOnly && (
          <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-lg text-sm transition-all">+ Add Record</button>
        )}
        <button onClick={() => fetchRecords(false)} disabled={loading}
          className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </PageHeader>

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <input type="text" value={searchInput} onChange={e => handleSearchChange(e.target.value)} placeholder="Search..." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2 pl-9 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-[#71717a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch('') }}
              className="text-xs text-[#71717a] hover:text-red-400 transition-colors px-2">Clear</button>
          )}
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider"><span>Content</span></th>
                {!readOnly && <th className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider w-32"><span>Created</span></th>}
                {!readOnly && <th className="px-4 py-3 text-left text-xs font-medium text-[#71717a] uppercase tracking-wider w-16"><span>Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    <td className="px-4 py-4" colSpan={3}><div className="skeleton h-4 w-full" /></td>
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-[#71717a] text-sm">No records yet.</td></tr>
              ) : (
                paged.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-pre-wrap">{rec.data?.content || '—'}</td>
                    {!readOnly && (
                      <td className="px-4 py-3 text-xs text-[#71717a] whitespace-nowrap">{new Date(rec.created_at).toLocaleDateString()}</td>
                    )}
                    {!readOnly && (
                      <td className="px-4 py-3 text-xs text-[#71717a] flex gap-1">
                        <button onClick={() => openModal(rec)} className="hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-[#2a2a2a]" title="Edit">✎</button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(rec.id)} className="hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-[#2a2a2a]" title="Delete">✕</button>
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
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">{editingId ? 'Edit Record' : 'Add Record'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Content</label>
                <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Type anything here..."
                  rows={8}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 resize-y min-h-[150px]" />
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
