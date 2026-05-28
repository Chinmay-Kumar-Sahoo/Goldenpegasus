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
  employee_name?: string | null
  last_reminder_sent_at?: string | null
}

type MarketingImportField =
  | 'name'
  | 'date'
  | 'recruiter_name'
  | 'recruiter_email'
  | 'organization_name'
  | 'implementation_partner'
  | 'end_client'
  | 'status'
  | 'project_start_date'
  | 'project_end_date'
  | 'interview_date'
  | 'interview_type'
  | 'client_name'
  | 'client_email'
  | 'implementation_poc_email'
  | 'interviewer_email'
  | 'notes'

const IMPORT_COLUMNS: Array<{ key: MarketingImportField; labels: string[]; isDate?: boolean }> = [
  { key: 'name', labels: ['Name', 'Candidate Name'] },
  { key: 'date', labels: ['Date'], isDate: true },
  { key: 'status', labels: ['Status'] },
  { key: 'recruiter_name', labels: ['Recruiter', 'Recruiter Name'] },
  { key: 'recruiter_email', labels: ['Recruiter Email'] },
  { key: 'organization_name', labels: ['Organization', 'Organization Name'] },
  { key: 'implementation_partner', labels: ['Implementation Partner'] },
  { key: 'end_client', labels: ['End Client'] },
  { key: 'interview_date', labels: ['Interview Date'], isDate: true },
  { key: 'interview_type', labels: ['Interview Type'] },
  { key: 'project_start_date', labels: ['Project Start Date'], isDate: true },
  { key: 'project_end_date', labels: ['Project End Date'], isDate: true },
  { key: 'client_name', labels: ['Client Name'] },
  { key: 'client_email', labels: ['Client Email'] },
  { key: 'implementation_poc_email', labels: ['Implementation POC Email'] },
  { key: 'interviewer_email', labels: ['Interviewer Email'] },
  { key: 'notes', labels: ['Notes'] },
]

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  closed: 'bg-red-500/10 text-red-400 border-red-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export default function MarketingPage({ isAdmin = false, readOnly = false }: { isAdmin?: boolean; readOnly?: boolean }) {
  const showEmployeeColumn = isAdmin || readOnly
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [records, setRecords] = useState<MarketingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MarketingRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', date: '', recruiter_name: '', recruiter_email: '', organization_name: '',
    implementation_partner: '', end_client: '', status: 'active',
    project_start_date: '', project_end_date: '', interview_date: '',
    implementation_poc_email: '', interviewer_email: '', notes: '',
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
    const marketingRecords = data || []
    const ownerIds = Array.from(new Set(marketingRecords.map(record => record.owner_id).filter(Boolean)))

    let ownerNames: Record<string, string> = {}
    if (ownerIds.length > 0) {
      const [{ data: profiles }, { data: employees }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
        supabase.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
      ])

      ownerNames = Object.fromEntries((profiles || []).map(profile => [
        profile.id,
        profile.full_name || profile.email || 'Unknown employee',
      ]))

      for (const employee of employees || []) {
        if (employee.user_id) {
          ownerNames[employee.user_id] = employee.full_name || employee.email || ownerNames[employee.user_id] || 'Unknown employee'
        }
      }
    }

    let lastReminderByRecord: Record<string, string> = {}
    if (isAdmin && marketingRecords.length > 0) {
      const { data: reminderLogs } = await supabase
        .from('marketing_reminder_logs')
        .select('marketing_record_id, sent_at')
        .is('error', null)
        .in('marketing_record_id', marketingRecords.map(record => record.id))
        .order('sent_at', { ascending: false })

      for (const log of reminderLogs || []) {
        if (!lastReminderByRecord[log.marketing_record_id]) {
          lastReminderByRecord[log.marketing_record_id] = log.sent_at
        }
      }
    }

    setRecords(marketingRecords.map(record => ({
      ...record,
      employee_name: ownerNames[record.owner_id] || 'Unknown employee',
      last_reminder_sent_at: lastReminderByRecord[record.id] || null,
    })))
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
        implementation_poc_email: rec.implementation_poc_email || '',
        interviewer_email: rec.interviewer_email || '', notes: rec.notes || '',
      })
    } else {
      setEditing(null)
      setForm({ name: '', date: '', recruiter_name: '', recruiter_email: '', organization_name: '', implementation_partner: '', end_client: '', status: 'active', project_start_date: '', project_end_date: '', interview_date: '', implementation_poc_email: '', interviewer_email: '', notes: '' })
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

  const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

  const formatExcelDate = (value: unknown, XLSX: any) => {
    if (!value) return null
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10)
    }
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
      }
    }
    const text = String(value).trim()
    if (!text) return null
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10)
  }

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImporting(true)
    setError('')

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Please sign in before importing marketing records.')
      }

      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      if (rows.length === 0) {
        throw new Error('The selected Excel file does not contain any rows.')
      }

      const aliasToField = new Map<string, MarketingImportField>()
      for (const column of IMPORT_COLUMNS) {
        aliasToField.set(normalizeHeader(column.key), column.key)
        for (const label of column.labels) {
          aliasToField.set(normalizeHeader(label), column.key)
        }
      }

      const dateFields = new Set(IMPORT_COLUMNS.filter(column => column.isDate).map(column => column.key))
      const importRows = rows.map(row => {
        const normalizedRow = new Map<MarketingImportField, unknown>()
        for (const [header, value] of Object.entries(row)) {
          const field = aliasToField.get(normalizeHeader(header))
          if (field) normalizedRow.set(field, value)
        }

        const record = Object.fromEntries(IMPORT_COLUMNS.map(column => {
          const rawValue = normalizedRow.get(column.key)
          const value = dateFields.has(column.key)
            ? formatExcelDate(rawValue, XLSX)
            : String(rawValue ?? '').trim() || null
          return [column.key, value]
        })) as Record<MarketingImportField, string | null>

        return {
          ...record,
          name: record.name || '',
          owner_id: user.id,
        }
      })

      const { error: importError } = await supabase.from('marketing_records').insert(importRows)
      if (importError) throw importError

      toast.success(`Imported ${importRows.length} marketing record${importRows.length === 1 ? '' : 's'}`)
      fetchRecords()
    } catch (err: any) {
      const message = err.message || 'Failed to import Excel file.'
      setError(message)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  const exportCSV = () => {
    const headers = ['Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Created Date', 'Status', 'Recruiter', 'Recruiter Email', '2nd Of Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Comments', ...(isAdmin ? ['Last Reminder'] : [])]
    const rows = filtered.map(r => [r.name, ...(showEmployeeColumn ? [r.employee_name] : []), r.date, r.status, r.recruiter_name, r.recruiter_email, r.organization_name, r.implementation_partner, r.implementation_poc_email, r.end_client, r.interview_date, r.interviewer_email, r.project_start_date, r.notes, ...(isAdmin ? [r.last_reminder_sent_at] : [])])
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
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              suppressHydrationWarning
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              suppressHydrationWarning
              className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50"
              title="Import Excel columns such as Name, Date, Status, Recruiter, Organization, End Client, Interview Date, Interviewer Email, and Notes"
            >
              {importing ? 'Importing...' : 'Import Excel'}
            </button>
            <button onClick={() => openModal()} suppressHydrationWarning className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
              + Add Record
            </button>
          </>
        )}
        <button onClick={exportCSV} suppressHydrationWarning className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all">
          Export CSV
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)}
          suppressHydrationWarning
          className="flex-1 min-w-[200px] bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          suppressHydrationWarning
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
                {['Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Created Date', 'Status', 'Recruiter', 'Recruiter Email', '2nd Of Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Comments', isAdmin ? 'Last Reminder' : '', !readOnly ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a]">
                    {Array.from({ length: 13 + (showEmployeeColumn ? 1 : 0) + (isAdmin ? 1 : 0) + (!readOnly ? 1 : 0) }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13 + (showEmployeeColumn ? 1 : 0) + (isAdmin ? 1 : 0) + (!readOnly ? 1 : 0)} className="px-4 py-12 text-center text-[#71717a] text-sm">No records found.</td></tr>
              ) : (
                filtered.map(rec => (
                  <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{rec.name}</td>
                    {showEmployeeColumn && (
                      <td className="px-4 py-3 text-sm text-white whitespace-nowrap">{rec.employee_name || 'Unknown employee'}</td>
                    )}
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
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.implementation_poc_email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.end_client || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.interview_date || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.interviewer_email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.project_start_date || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] max-w-[200px] truncate" title={rec.notes || ''}>{rec.notes || '—'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">
                        {rec.last_reminder_sent_at ? new Date(rec.last_reminder_sent_at).toLocaleString() : '—'}
                      </td>
                    )}
                    {!readOnly && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {canEdit(rec) && (
                            <button onClick={() => openModal(rec)} className="text-xs bg-[#1a1a1a] hover:bg-[#22c55e]/10 hover:text-[#22c55e] border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Edit</button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDelete(rec.id)} className="text-xs bg-[#1a1a1a] hover:bg-red-500/10 hover:text-red-400 border border-[#2a2a2a] px-3 py-1 rounded-lg transition-all">Delete</button>
                          )}
                        </div>
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
                { label: 'Candidate Name *', name: 'name', type: 'text', required: true, span: 2 },
                { label: 'Created Date', name: 'date', type: 'date', span: 1 },
                { label: 'Status', name: 'status', type: 'select', options: ['active', 'pending', 'completed', 'closed'], span: 1 },
                { label: 'Recruiter Name', name: 'recruiter_name', type: 'text', span: 1 },
                { label: 'Recruiter Email', name: 'recruiter_email', type: 'email', span: 1 },
                { label: '2nd Of Recruiter', name: 'organization_name', type: 'text', span: 1 },
                { label: 'Implementation Partner', name: 'implementation_partner', type: 'text', span: 1 },
                { label: 'End Client', name: 'end_client', type: 'text', span: 1 },
                { label: 'Interview Date', name: 'interview_date', type: 'date', span: 1 },
                { label: 'Project Start Date', name: 'project_start_date', type: 'date', span: 1 },
                { label: 'Implementation POC Email', name: 'implementation_poc_email', type: 'email', span: 1 },
                { label: 'Interviewer Email', name: 'interviewer_email', type: 'email', span: 1 },
                { label: 'Comments', name: 'notes', type: 'textarea', span: 2 },
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
