'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface MarketingRecord {
  id: string
  owner_id: string
  name: string
  date: string | null
  recruiter_name: string | null
  recruiter_email: string | null
  organization_name: string | null
  implementation_partner: string | null
  end_client: string | null
  status: string | null
  project_start_date: string | null
  project_end_date: string | null
  interview_date: string | null
  interview_type: string | null
  client_name: string | null
  client_email: string | null
  implementation_poc_email: string | null
  interviewer_email: string | null
  notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  closed: 'bg-red-500/10 text-red-400 border-red-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export default function MarketingPage({ isAdmin = false, readOnly = false }: { isAdmin?: boolean; readOnly?: boolean }) {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [records, setRecords] = useState<MarketingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MarketingRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', date: '', recruiter_name: '', recruiter_email: '', organization_name: '',
    implementation_partner: '', end_client: '', status: 'active',
    project_start_date: '', project_end_date: '', interview_date: '', interview_type: '',
    client_name: '', client_email: '', implementation_poc_email: '', interviewer_email: '', notes: '',
  })

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    // Always fetch user so canEdit() works correctly
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? null
    setCurrentUserId(userId)

    // "My Marketing" (isAdmin=false, readOnly=false) — only show own records
    let query = supabase.from('marketing_records').select('*').order('created_at', { ascending: false })
    if (!isAdmin && !readOnly && userId) {
      query = query.eq('owner_id', userId)
    }
    const { data } = await query
    setRecords(data || [])
    setLoading(false)
  }, [supabase, isAdmin, readOnly])

  useEffect(() => {
    fetchRecords()

    // Realtime subscription — re-fetch on any change
    const channel = supabase.channel('marketing_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_records' }, () => {
        fetchRecords()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchRecords, supabase])

  const canEdit = (record: MarketingRecord) => !readOnly && (isAdmin || record.owner_id === currentUserId)

  const openModal = (rec?: MarketingRecord) => {
    if (rec) {
      setEditing(rec)
      setForm({
        name: rec.name, date: rec.date || '', recruiter_name: rec.recruiter_name || '',
        recruiter_email: rec.recruiter_email || '', organization_name: rec.organization_name || '',
        implementation_partner: rec.implementation_partner || '', end_client: rec.end_client || '',
        status: rec.status || 'active', project_start_date: rec.project_start_date || '',
        project_end_date: rec.project_end_date || '', interview_date: rec.interview_date || '',
        interview_type: rec.interview_type || '', client_name: rec.client_name || '',
        client_email: rec.client_email || '', implementation_poc_email: rec.implementation_poc_email || '',
        interviewer_email: rec.interviewer_email || '', notes: rec.notes || '',
      })
    } else {
      setEditing(null)
      setForm({ name: '', date: '', recruiter_name: '', recruiter_email: '', organization_name: '', implementation_partner: '', end_client: '', status: 'active', project_start_date: '', project_end_date: '', interview_date: '', interview_type: '', client_name: '', client_email: '', implementation_poc_email: '', interviewer_email: '', notes: '' })
    }
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const cleanForm = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]))
    if (editing) {
      const { error: err } = await supabase.from('marketing_records').update({ ...cleanForm, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); toast.error('Failed to update record'); return }
      toast.success('Record updated successfully')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('marketing_records').insert({ ...cleanForm, name: form.name, owner_id: user?.id })
      if (err) { setError(err.message); setSaving(false); toast.error('Failed to add record'); return }
      toast.success('Record added successfully')
    }
    setSaving(false)
    setShowModal(false)
    fetchRecords()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return
    await supabase.from('marketing_records').delete().eq('id', id)
    toast.success('Record deleted')
    fetchRecords()
  }

  const exportCSV = () => {
    const headers = ['Name', 'Date', 'Status', 'Recruiter', 'Recruiter Email', 'Organization', 'Implementation Partner', 'End Client', 'Interview Date', 'Interviewer Email']
    const rows = filtered.map(r => [r.name, r.date, r.status, r.recruiter_name, r.recruiter_email, r.organization_name, r.implementation_partner, r.end_client, r.interview_date, r.interviewer_email])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'marketing_records.csv'; a.click()
  }

  const filtered = records.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.organization_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.end_client || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div>
      <PageHeader title={isAdmin ? "All Marketing" : (readOnly ? "All Marketing" : "My Marketing")} subtitle={readOnly ? 'Read-only view of all marketing records' : 'Manage marketing records'}>
        {!readOnly && (
          <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
            + Add Record
          </button>
        )}
        <button onClick={exportCSV} className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all">
          Export CSV
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Name', 'Date', 'Status', 'Recruiter', 'Recruiter Email', 'Organization', 'Implementation Partner', 'End Client', 'Interview Date', 'Interviewer Email', !readOnly ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
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
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#71717a] text-sm">No records found.</td></tr>
              ) : (
                filtered.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{rec.name}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.date || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[rec.status || 'active'] || STATUS_COLORS.active}`}>
                        {rec.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.recruiter_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.recruiter_email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.organization_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.implementation_partner || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.end_client || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.interview_date || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.interviewer_email || '—'}</td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        {canEdit(rec) && (
                          <div className="flex gap-2">
                            <button onClick={() => openModal(rec)} className="text-xs bg-[#1a1a1a] hover:bg-[#22c55e]/10 hover:text-[#22c55e] border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Edit</button>
                            <button onClick={() => handleDelete(rec.id)} className="text-xs bg-[#1a1a1a] hover:bg-red-500/10 hover:text-red-400 border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Delete</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#2a2a2a] text-xs text-[#71717a]">
          Showing {filtered.length} of {records.length} records
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">{editing ? 'Edit Record' : 'Add Marketing Record'}</h2>
            <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
              {[
                { label: 'Name *', name: 'name', type: 'text', required: true, span: 2 },
                { label: 'Date', name: 'date', type: 'date', span: 1 },
                { label: 'Status', name: 'status', type: 'select', options: ['active', 'pending', 'completed', 'closed'], span: 1 },
                { label: 'Recruiter Name', name: 'recruiter_name', type: 'text', span: 1 },
                { label: 'Recruiter Email', name: 'recruiter_email', type: 'email', span: 1 },
                { label: 'Organization Name', name: 'organization_name', type: 'text', span: 1 },
                { label: 'Implementation Partner', name: 'implementation_partner', type: 'text', span: 1 },
                { label: 'End Client', name: 'end_client', type: 'text', span: 1 },
                { label: 'Interview Date', name: 'interview_date', type: 'date', span: 1 },
                { label: 'Interview Type', name: 'interview_type', type: 'text', span: 1 },
                { label: 'Project Start Date', name: 'project_start_date', type: 'date', span: 1 },
                { label: 'Client Name', name: 'client_name', type: 'text', span: 1 },
                { label: 'Client Email', name: 'client_email', type: 'email', span: 1 },
                { label: 'Implementation POC Email', name: 'implementation_poc_email', type: 'email', span: 1 },
                { label: 'Interviewer Email', name: 'interviewer_email', type: 'email', span: 1 },
                { label: 'Notes', name: 'notes', type: 'textarea', span: 2 },
              ].map(field => (
                <div key={field.name} className={field.span === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={form[field.name as keyof typeof form]} onChange={e => setForm({ ...form, [field.name]: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={form[field.name as keyof typeof form] || ''} onChange={e => setForm({ ...form, [field.name]: e.target.value })} rows={2}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 resize-none" />
                  ) : (
                    <input type={field.type} value={form[field.name as keyof typeof form] || ''} onChange={e => setForm({ ...form, [field.name]: e.target.value })} required={field.required}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                  )}
                </div>
              ))}
              {error && <div className="col-span-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
