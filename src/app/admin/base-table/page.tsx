'use client'

import { useState, useEffect, useCallback } from 'react'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface BaseRecord {
  id: string
  technology: string
  sub_technology: string | null
  comments: string | null
  created_at: string
  updated_at: string
}

interface FormData {
  technology: string
  sub_technology: string
  comments: string
}

export default function AdminBaseTablePage() {
  const [records, setRecords] = useState<BaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BaseRecord | null>(null)
  const [form, setForm] = useState<FormData>({ technology: '', sub_technology: '', comments: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/base-table')
      const json = await res.json()
      setRecords(json.records || [])
    } catch {
      setRecords([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const openModal = (rec?: BaseRecord) => {
    if (rec) {
      setEditing(rec)
      setForm({ technology: rec.technology, sub_technology: rec.sub_technology || '', comments: rec.comments || '' })
    } else {
      setEditing(null)
      setForm({ technology: '', sub_technology: '', comments: '' })
    }
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.technology.trim()) { setError('Technology is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/base-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      toast.success(editing ? 'Updated' : 'Created')
      setShowModal(false)
      fetchRecords()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return
    try {
      const res = await fetch('/api/admin/base-table', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Delete failed') }
      toast.success('Deleted')
      fetchRecords()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const q = search.toLowerCase().trim()
  const filtered = q
    ? records.filter(r =>
        r.technology.toLowerCase().includes(q) ||
        (r.sub_technology || '').toLowerCase().includes(q) ||
        (r.comments || '').toLowerCase().includes(q)
      )
    : records

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader title="Base Table" subtitle="Manage Technology, Sub-Technology, and Comments">
        <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          + Add Record
        </button>
      </PageHeader>

      <div className="shrink-0 mb-4">
        <div className="relative max-w-md">
          <input type="text" placeholder="Search technology, sub-technology, comments..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-xl pl-4 pr-10 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors text-lg leading-none">&times;</button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Technology</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Sub Technology</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Comments</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-[#71717a] text-sm">No records found.</td></tr>
              ) : (
                filtered.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{rec.technology}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.sub_technology || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] max-w-md truncate">{rec.comments || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openModal(rec)} className="text-xs text-[#71717a] hover:text-[#22c55e] transition-colors mr-3">Edit</button>
                      <button onClick={() => handleDelete(rec.id)} className="text-xs text-[#71717a] hover:text-red-400 transition-colors">Delete</button>
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
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-6">{editing ? 'Edit Record' : 'Add Record'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Technology *</label>
                <input type="text" value={form.technology} onChange={e => setForm({ ...form, technology: e.target.value })} placeholder="e.g. React, Node.js"
                  required className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Sub Technology</label>
                <input type="text" value={form.sub_technology} onChange={e => setForm({ ...form, sub_technology: e.target.value })} placeholder="e.g. Next.js, Express"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Comments</label>
                <textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} placeholder="Optional notes..."
                  rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60 transition-all resize-none" />
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
