'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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

const DATE_COLUMNS: Record<string, string> = {
  'Created Date': 'date',
  'Interview Date': 'interview_date',
  'Project Start Date': 'project_start_date',
  'Project End Date': 'project_end_date',
}

const LOCKABLE_FIELDS = new Set(['name', 'date', 'employee_name'])

export default function MarketingPage({
  isAdmin = false,
  readOnly = false,
  currentUserId: propUserId = null,
  initialRecords: serverRecords = [],
  initialOwnerNames: serverOwnerNames = {},
}: {
  isAdmin?: boolean
  readOnly?: boolean
  currentUserId?: string | null
  initialRecords?: MarketingRecord[]
  initialOwnerNames?: Record<string, string>
}) {
  const showEmployeeColumn = isAdmin || readOnly
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [records, setRecords] = useState<MarketingRecord[]>(serverRecords.map(r => ({
    ...r,
    employee_name: r.employee_name || serverOwnerNames[r.owner_id] || 'Unknown employee',
  })))
  const [loading, setLoading] = useState(serverRecords.length === 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null)
  const [dateFilters, setDateFilters] = useState({
    date: { start: '', end: '' },
    interview_date: { start: '', end: '' },
    project_start_date: { start: '', end: '' },
    project_end_date: { start: '', end: '' },
  })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MarketingRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId)
  const [form, setForm] = useState({
    name: '', date: '', recruiter_name: '', recruiter_email: '', organization_name: '',
    implementation_partner: '', end_client: '', status: 'active',
    project_start_date: '', project_end_date: '', interview_date: '',
    implementation_poc_email: '', interviewer_email: '', notes: '',
    employee_name: '',
  })

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (!isAdmin && currentUserId) params.set('owner_id', currentUserId)
      const qs = params.toString()
      const url = `/api/marketing${qs ? '?' + qs : ''}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error('Failed to load records')
      const json = await res.json()
      setRecords(json.records || [])
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.error('Request timed out. Please try again or check your network connection.')
        setError('Request timed out')
      } else {
        toast.error('Failed to load records. Check your connection.')
        setError(err.message || 'Failed to load records')
      }
    } finally {
      setLoading(false)
    }
  }, [isAdmin, currentUserId])

  useEffect(() => {
    if (records.length === 0) fetchRecords()
  }, [fetchRecords])

  const dateFilterRef = useRef<HTMLTableSectionElement>(null)
  const dateFilterBtnRef = useRef<HTMLButtonElement | null>(null)

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
        employee_name: rec.employee_name || '',
      })
    } else {
      setEditing(null)
      setForm({ name: '', date: todayIST(), recruiter_name: '', recruiter_email: '', organization_name: '', implementation_partner: '', end_client: '', status: 'active', project_start_date: '', project_end_date: '', interview_date: '', implementation_poc_email: '', interviewer_email: '', notes: '', employee_name: isAdmin ? 'Admin' : '' })
    }
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const cleanForm = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]))
    const payload = editing ? { ...cleanForm, id: editing.id } : { ...cleanForm, name: form.name }
    try {
      const res = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { throw new Error(json.error || 'Failed to save record') }
      toast.success(editing ? 'Record updated successfully' : 'Record added successfully')
      setSaving(false)
      setShowModal(false)
      fetchRecords()
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
      toast.error('Failed to save record')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return
    try {
      await fetch('/api/marketing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      toast.success('Record deleted')
      fetchRecords()
    } catch {
      toast.error('Failed to delete record')
    }
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
        }
      })

      for (const row of importRows) {
        await fetch('/api/marketing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        })
      }

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
    const headers = ['Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Created Date', 'Status', 'Recruiter', 'Recruiter Email', '2nd Up Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Project End Date', 'Comments', ...(isAdmin ? ['Last Reminder'] : [])]
    const rows = filtered.map(r => [r.name, ...(showEmployeeColumn ? [r.employee_name] : []), r.date, r.status, r.recruiter_name, r.recruiter_email, r.organization_name, r.implementation_partner, r.implementation_poc_email, r.end_client, r.interview_date, r.interviewer_email, r.project_start_date, r.project_end_date, r.notes, ...(isAdmin ? [r.last_reminder_sent_at] : [])])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'marketing_records.csv'; a.click()
    setShowExportMenu(false)
  }

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape' })

    const headers = ['Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Created Date', 'Status', 'Recruiter', 'Recruiter Email', '2nd Up Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Project End Date', 'Comments', ...(isAdmin ? ['Last Reminder'] : [])]
    const data = filtered.map(r => [r.name, ...(showEmployeeColumn ? [r.employee_name || ''] : []), r.date || '', r.status || '', r.recruiter_name || '', r.recruiter_email || '', r.organization_name || '', r.implementation_partner || '', r.implementation_poc_email || '', r.end_client || '', r.interview_date || '', r.interviewer_email || '', r.project_start_date || '', r.project_end_date || '', r.notes || '', ...(isAdmin ? [r.last_reminder_sent_at ? new Date(r.last_reminder_sent_at).toLocaleString() : ''] : [])])

    autoTable(doc, {
      head: [headers],
      body: data,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 197, 94] },
    })

    doc.save('marketing_records.pdf')
    setShowExportMenu(false)
  }

  const inRange = (val: string | null, range: { start: string; end: string }) => {
    if (!range.start && !range.end) return true
    if (!val) return false
    const d = val.slice(0, 10)
    if (range.start && d < range.start) return false
    if (range.end && d > range.end) return false
    return true
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const hasDateFilter = Object.values(dateFilters).some(r => r.start || r.end)
    if (!q && statusFilter === 'all' && !hasDateFilter) return records
    return records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!inRange(r.date, dateFilters.date)) return false
      if (!inRange(r.interview_date, dateFilters.interview_date)) return false
      if (!inRange(r.project_start_date, dateFilters.project_start_date)) return false
      if (!inRange(r.project_end_date, dateFilters.project_end_date)) return false
      if (!q) return true
      const fields = [
        r.name, r.date, r.status, r.recruiter_name, r.recruiter_email,
        r.organization_name, r.implementation_partner, r.end_client,
        r.interview_type, r.client_name, r.client_email,
        r.implementation_poc_email, r.interviewer_email, r.notes,
        r.employee_name, r.project_start_date, r.project_end_date, r.interview_date,
      ]
      return fields.some(f => f && f.toLowerCase().includes(q))
    })
  }, [records, search, statusFilter, dateFilters])

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
        <div ref={exportMenuRef} className="relative">
          <button onClick={() => setShowExportMenu(v => !v)} suppressHydrationWarning className="border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white px-4 py-2 rounded-xl text-sm transition-all">
            Export ▾
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden z-50 min-w-[120px] shadow-xl">
              <button onClick={exportCSV} suppressHydrationWarning className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#2a2a2a] transition-colors">CSV</button>
              <button onClick={exportPDF} suppressHydrationWarning className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#2a2a2a] transition-colors">PDF</button>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
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
        {Object.values(dateFilters).some(r => r.start || r.end) && (
          <button onClick={() => { setDateFilters({ date: { start: '', end: '' }, interview_date: { start: '', end: '' }, project_start_date: { start: '', end: '' }, project_end_date: { start: '', end: '' } }); setActiveDateFilter(null) }} suppressHydrationWarning
            className="text-xs text-[#71717a] hover:text-red-400 transition-colors px-2">
            Clear all date filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className={`bg-[#111111] border border-[#2a2a2a] rounded-2xl ${activeDateFilter ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className={activeDateFilter ? 'overflow-visible' : 'overflow-x-auto'}>
          <table className="w-full">
            <thead ref={dateFilterRef}>
              <tr className="border-b border-[#2a2a2a]">
                {['Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Created Date', 'Status', 'Recruiter', 'Recruiter Email', '2nd Up Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Project End Date', 'Comments', isAdmin ? 'Last Reminder' : '', !readOnly ? 'Actions' : ''].filter(Boolean).map(h => {
                  const dateKey = DATE_COLUMNS[h]
                  const isActive = activeDateFilter === dateKey
                  const hasFilter = dateFilters[dateKey as keyof typeof dateFilters]?.start || dateFilters[dateKey as keyof typeof dateFilters]?.end
                  return (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap relative">
                      {dateKey ? (
                        <div className="flex items-center gap-1.5">
                          <span>{h}</span>
                          <button ref={dateKey === activeDateFilter ? (el) => { dateFilterBtnRef.current = el } : undefined}
                            onClick={(e) => { e.stopPropagation(); setActiveDateFilter(isActive ? null : dateKey) }}
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
                    {Array.from({ length: 14 + (showEmployeeColumn ? 1 : 0) + (isAdmin ? 1 : 0) + (!readOnly ? 1 : 0) }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={14 + (showEmployeeColumn ? 1 : 0) + (isAdmin ? 1 : 0) + (!readOnly ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="text-red-400 text-sm mb-1">Failed to load records</div>
                  <div className="text-[#71717a] text-xs">{error.includes('timed') ? 'The request timed out. Try refreshing the page.' : 'Please check your connection and try again.'}</div>
                </td></tr>
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
                    <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.project_end_date || '—'}</td>
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
                ...(isAdmin ? [{ label: 'Employee Name', name: 'employee_name' as const, type: 'text' as const, span: 1 as const }] : []),
                { label: 'Candidate Name *', name: 'name', type: 'text', required: true, span: 2 },
                { label: 'Created Date', name: 'date', type: 'date', span: 1 },
                { label: 'Status', name: 'status', type: 'select', options: ['active', 'pending', 'completed', 'closed'], span: 1 },
                { label: 'Recruiter Name', name: 'recruiter_name', type: 'text', span: 1 },
                { label: 'Recruiter Email', name: 'recruiter_email', type: 'email', span: 1 },
                { label: '2nd Up Recruiter', name: 'organization_name', type: 'text', span: 1 },
                { label: 'Implementation Partner', name: 'implementation_partner', type: 'text', span: 1 },
                { label: 'End Client', name: 'end_client', type: 'text', span: 1 },
                { label: 'Interview Date', name: 'interview_date', type: 'date', span: 1 },
                { label: 'Project Start Date', name: 'project_start_date', type: 'date', span: 1 },
                { label: 'Project End Date', name: 'project_end_date', type: 'date', span: 1 },
                { label: 'Implementation POC Email', name: 'implementation_poc_email', type: 'email', span: 1 },
                { label: 'Interviewer Email', name: 'interviewer_email', type: 'email', span: 1 },
                { label: 'Comments', name: 'notes', type: 'textarea', span: 2 },
              ].map(field => {
                const locked = !!editing && LOCKABLE_FIELDS.has(field.name) && !!form[field.name as keyof typeof form]
                return (
                <div key={field.name} className={field.span === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={form[field.name as keyof typeof form]} onChange={e => setForm({ ...form, [field.name]: e.target.value })} disabled={locked}
                      className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={form[field.name as keyof typeof form] || ''} onChange={e => setForm({ ...form, [field.name]: e.target.value })} rows={2} disabled={locked}
                      className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 resize-none ${locked ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  ) : (
                    <input type={field.type} value={form[field.name as keyof typeof form] || ''} onChange={e => setForm({ ...form, [field.name]: e.target.value })} required={field.required} disabled={locked}
                      className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 ${locked ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  )}
                  {locked && <p className="text-[10px] text-[#71717a] mt-1">Locked after save</p>}
                </div>
                )
              })}
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
