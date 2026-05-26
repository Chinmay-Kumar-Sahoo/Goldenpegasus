'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  inactive: 'bg-red-500/10 text-red-400 border-red-500/20',
  prospect: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}

export default function CandidatesPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [records, setRecords] = useState<CandidateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CandidateRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ Candidate_name: '', Candidate_email: '', client_phone: '', company_name: '', address: '', status: 'active', contract_start: '', contract_end: '', project_type: '', notes: '' })

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('Candidate_records').select('*').order('created_at', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }, [supabase, isAdmin])

  useEffect(() => {
    fetchRecords()

    // Realtime subscription — re-fetch on any change
    const channel = supabase.channel('candidate_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Candidate_records' }, () => {
        fetchRecords()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchRecords, supabase])

  const openModal = (rec?: CandidateRecord) => {
    if (rec) {
      setEditing(rec)
      setForm({ Candidate_name: rec.Candidate_name, Candidate_email: rec.Candidate_email || '', client_phone: rec.client_phone || '', company_name: rec.company_name || '', address: rec.address || '', status: rec.status || 'active', contract_start: rec.contract_start || '', contract_end: rec.contract_end || '', project_type: rec.project_type || '', notes: rec.notes || '' })
    } else {
      setEditing(null)
      setForm({ Candidate_name: '', Candidate_email: '', client_phone: '', company_name: '', address: '', status: 'active', contract_start: '', contract_end: '', project_type: '', notes: '' })
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
      const { error: err } = await supabase.from('Candidate_records').update({ ...cleanForm, updated_at: new Date().toISOString() }).eq('id', editing.id)
      if (err) { setError(err.message); setSaving(false); toast.error('Failed to update candidate'); return }
      toast.success('Candidate updated successfully')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('Candidate_records').insert({ ...cleanForm, Candidate_name: form.Candidate_name, owner_id: user?.id })
      if (err) { setError(err.message); setSaving(false); toast.error('Failed to add candidate'); return }
      toast.success('Candidate added successfully')
    }
    setSaving(false)
    setShowModal(false)
    fetchRecords()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this candidate record?')) return
    await supabase.from('Candidate_records').delete().eq('id', id)
    toast.success('Candidate deleted')
    fetchRecords()
  }

  const exportCSV = () => {
    const headers = ['Candidate Name', 'Email', 'Phone', 'Company', 'Status', 'Project Type', 'Contract Start', 'Contract End', 'Notes']
    const rows = filtered.map(r => [r.Candidate_name, r.Candidate_email, r.client_phone, r.company_name, r.status, r.project_type, r.contract_start, r.contract_end, r.notes])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'candidate_records.csv'; a.click()
  }

  const filtered = records.filter(r =>
    r.Candidate_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.Candidate_email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader title={isAdmin ? 'All Candidate Records' : 'My Candidates'} subtitle="Manage candidate information">
        <button onClick={() => openModal()} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">+ Add Candidate</button>
        <button onClick={exportCSV} className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all">Export CSV</button>
      </PageHeader>

      <div className="mb-6">
        <input type="text" placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full md:w-96 bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60" />
      </div>

      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['Candidate Name', 'Email', 'Phone', 'Company', 'Status', 'Project Type', 'Actions'].map(h => (
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
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[#71717a] text-sm">No candidate records found.</td></tr>
              ) : (
                filtered.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{rec.Candidate_name}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.Candidate_email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.client_phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[rec.status || 'active'] || STATUS_COLORS.active}`}>
                        {rec.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.project_type || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openModal(rec)} className="text-xs bg-[#1a1a1a] hover:bg-[#22c55e]/10 hover:text-[#22c55e] border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Edit</button>
                        <button onClick={() => handleDelete(rec.id)} className="text-xs bg-[#1a1a1a] hover:bg-red-500/10 hover:text-red-400 border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#2a2a2a] text-xs text-[#71717a]">Showing {filtered.length} of {records.length} records</div>
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
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="prospect">Prospect</option>
                </select>
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
    </div>
  )
}
