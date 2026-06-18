'use client'

import { useState, useEffect, useCallback } from 'react'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface SubTechnology {
  id: string
  technology_id: string
  name: string
  comments: string | null
}

interface Technology {
  id: string
  name: string
  comments: string | null
  sub_technologies: SubTechnology[]
}

interface TechForm {
  name: string
  comments: string
}

interface SubForm {
  technology_id: string
  name: string
  comments: string
}

export default function AdminBaseTablePage() {
  const [technologies, setTechnologies] = useState<Technology[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Tech modal
  const [showTechModal, setShowTechModal] = useState(false)
  const [editingTech, setEditingTech] = useState<Technology | null>(null)
  const [techForm, setTechForm] = useState<TechForm>({ name: '', comments: '' })
  const [techSaving, setTechSaving] = useState(false)
  const [techError, setTechError] = useState('')

  // Sub modal
  const [showSubModal, setShowSubModal] = useState(false)
  const [editingSub, setEditingSub] = useState<SubTechnology | null>(null)
  const [subForm, setSubForm] = useState<SubForm>({ technology_id: '', name: '', comments: '' })
  const [subSaving, setSubSaving] = useState(false)
  const [subError, setSubError] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const fetchTechnologies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/base-table')
      const json = await res.json()
      setTechnologies(json.technologies || [])
    } catch {
      setTechnologies([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTechnologies() }, [fetchTechnologies])

  // ── Technology CRUD ──

  const openTechModal = (tech?: Technology) => {
    if (tech) {
      setEditingTech(tech)
      setTechForm({ name: tech.name, comments: tech.comments || '' })
    } else {
      setEditingTech(null)
      setTechForm({ name: '', comments: '' })
    }
    setTechError('')
    setShowTechModal(true)
  }

  const handleTechSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setTechError('')
    if (!techForm.name.trim()) { setTechError('Technology name is required'); return }
    setTechSaving(true)
    try {
      const res = await fetch('/api/admin/base-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'technology',
          ...(editingTech ? { id: editingTech.id } : {}),
          ...techForm,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      toast.success(editingTech ? 'Technology updated' : 'Technology created')
      setShowTechModal(false)
      fetchTechnologies()
    } catch (err: any) {
      setTechError(err.message)
    }
    setTechSaving(false)
  }

  const handleTechDelete = async (id: string) => {
    if (!confirm('Delete this technology and all its sub-technologies?')) return
    try {
      const res = await fetch('/api/admin/base-table', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'technology', id }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Delete failed') }
      toast.success('Technology deleted')
      fetchTechnologies()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ── Sub-Technology CRUD ──

  const openSubModal = (techId: string, sub?: SubTechnology) => {
    if (sub) {
      setEditingSub(sub)
      setSubForm({ technology_id: sub.technology_id, name: sub.name, comments: sub.comments || '' })
    } else {
      setEditingSub(null)
      setSubForm({ technology_id: techId, name: '', comments: '' })
    }
    setSubError('')
    setShowSubModal(true)
  }

  const handleSubSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubError('')
    if (!subForm.name.trim()) { setSubError('Sub-technology name is required'); return }
    setSubSaving(true)
    try {
      const res = await fetch('/api/admin/base-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'sub',
          ...(editingSub ? { id: editingSub.id } : {}),
          ...subForm,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      toast.success(editingSub ? 'Sub-technology updated' : 'Sub-technology created')
      setShowSubModal(false)
      fetchTechnologies()
    } catch (err: any) {
      setSubError(err.message)
    }
    setSubSaving(false)
  }

  const handleSubDelete = async (id: string) => {
    if (!confirm('Delete this sub-technology?')) return
    try {
      const res = await fetch('/api/admin/base-table', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sub', id }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Delete failed') }
      toast.success('Sub-technology deleted')
      fetchTechnologies()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ── Bulk delete technologies ──

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} technologies and all their sub-technologies?`)) return
    try {
      const res = await fetch('/api/admin/base-table', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'technology', ids: Array.from(selectedIds) }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Bulk delete failed') }
      toast.success(`Deleted ${selectedIds.size} technologies`)
      setSelectedIds(new Set())
      fetchTechnologies()
    } catch (err: any) {
      toast.error(err.message || 'Bulk delete failed')
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(t => t.id)))
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const q = search.toLowerCase().trim()
  const filtered = q
    ? technologies.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.comments || '').toLowerCase().includes(q) ||
        t.sub_technologies.some(s => s.name.toLowerCase().includes(q))
      )
    : technologies

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader title="Base Table" subtitle="Manage Technologies and Sub-Technologies">
        <button onClick={() => openTechModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          + Add Technology
        </button>
      </PageHeader>

      <div className="shrink-0 mb-4 space-y-4">
        <div className="relative max-w-md">
          <input type="text" placeholder="Search technologies or sub-technologies..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors text-lg leading-none">&times;</button>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
            <span className="text-sm text-[#a1a1aa]">{selectedIds.size} selected</span>
            <button onClick={handleBulkDelete} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-all">Delete Selected</button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#71717a] hover:text-white ml-auto transition-colors">Clear selection</button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left px-2 py-3 w-10">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                    className="accent-[#22c55e] cursor-pointer" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Technology</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Comments</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Sub-Technologies</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[#71717a] text-sm">No technologies found.</td></tr>
              ) : (
                filtered.map(tech => {
                  const isExpanded = expanded.has(tech.id)
                  return (
                    <tr key={tech.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-2 py-3">
                        <input type="checkbox" checked={selectedIds.has(tech.id)} onChange={() => toggleSelect(tech.id)}
                          className="accent-[#22c55e] cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleExpand(tech.id)} className="flex items-center gap-2 text-sm text-white font-medium hover:text-[#22c55e] transition-colors">
                          <span className={`text-[#71717a] text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
                          {tech.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#a1a1aa] max-w-xs truncate">{tech.comments || '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{tech.sub_technologies.length}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openSubModal(tech.id)} className="text-xs text-[#71717a] hover:text-[#22c55e] transition-colors mr-3" title="Add Sub-Technology">+ Sub</button>
                        <button onClick={() => openTechModal(tech)} className="text-xs text-[#71717a] hover:text-[#22c55e] transition-colors mr-3">Edit</button>
                        <button onClick={() => handleTechDelete(tech.id)} className="text-xs text-[#71717a] hover:text-red-400 transition-colors">Delete</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-technology rows rendered outside the table as independent cards below each expanded tech */}
      {filtered.map(tech =>
        expanded.has(tech.id) && tech.sub_technologies.length > 0 ? (
          <div key={`sub-${tech.id}`} className="mt-1 mb-3 ml-12">
            <div className="text-xs text-[#71717a] font-medium mb-2">Sub-Technologies</div>
            <div className="space-y-1">
              {tech.sub_technologies.map(sub => (
                <div key={sub.id} className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5">
                  <span className="text-sm text-white flex-1">{sub.name}</span>
                  {sub.comments && <span className="text-xs text-[#71717a] mr-4 max-w-xs truncate">{sub.comments}</span>}
                  <button onClick={() => openSubModal(tech.id, sub)} className="text-xs text-[#71717a] hover:text-[#22c55e] transition-colors mr-3">Edit</button>
                  <button onClick={() => handleSubDelete(sub.id)} className="text-xs text-[#71717a] hover:text-red-400 transition-colors">Delete</button>
                </div>
              ))}
            </div>
          </div>
        ) : expanded.has(tech.id) && tech.sub_technologies.length === 0 ? (
          <div key={`sub-empty-${tech.id}`} className="mt-1 mb-3 ml-12">
            <div className="text-xs text-[#71717a] italic px-4 py-2">No sub-technologies yet. Click &quot;+ Sub&quot; to add one.</div>
          </div>
        ) : null
      )}

      {/* Technology Modal */}
      {showTechModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-6">{editingTech ? 'Edit Technology' : 'Add Technology'}</h2>
            <form onSubmit={handleTechSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Technology Name *</label>
                <input type="text" value={techForm.name} onChange={e => setTechForm({ ...techForm, name: e.target.value })} placeholder="e.g. React, Node.js"
                  required className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Comments</label>
                <textarea value={techForm.comments} onChange={e => setTechForm({ ...techForm, comments: e.target.value })} placeholder="Optional notes..."
                  rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all resize-none" />
              </div>
              {techError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{techError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTechModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={techSaving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {techSaving ? 'Saving...' : editingTech ? 'Save Changes' : 'Add Technology'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Technology Modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-6">{editingSub ? 'Edit Sub-Technology' : 'Add Sub-Technology'}</h2>
            <form onSubmit={handleSubSave} className="space-y-4">
              {!editingSub && (
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Technology</label>
                  <select value={subForm.technology_id} onChange={e => setSubForm({ ...subForm, technology_id: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 transition-all">
                    {technologies.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editingSub && (
                <div className="text-sm text-[#71717a]">
                  Technology: <span className="text-white">{technologies.find(t => t.id === subForm.technology_id)?.name}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Sub-Technology Name *</label>
                <input type="text" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} placeholder="e.g. Next.js, Express"
                  required className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Comments</label>
                <textarea value={subForm.comments} onChange={e => setSubForm({ ...subForm, comments: e.target.value })} placeholder="Optional notes..."
                  rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all resize-none" />
              </div>
              {subError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{subError}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSubModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={subSaving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {subSaving ? 'Saving...' : editingSub ? 'Save Changes' : 'Add Sub-Technology'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
