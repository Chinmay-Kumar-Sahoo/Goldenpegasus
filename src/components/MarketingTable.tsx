'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
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
  backup_employee_name?: string | null
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
  | 'employee_name'
  | 'backup_employee_name'

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
  { key: 'employee_name', labels: ['Primary Employee', 'Employee', 'Employee Name', 'Primary Owner'] },
  { key: 'backup_employee_name', labels: ['Backup Employee', 'Backup Employee Name', 'Secondary Employee'] },
]

const STATUS_COLORS: Record<string, string> = {
  'active': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'pending': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'completed': 'bg-green-500/10 text-green-400 border-green-500/20',
  'closed': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Initial Screening': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Introductory call': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Project Received': 'bg-green-500/10 text-green-400 border-green-500/20',
  'RTR Confirmed': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'Screening Call': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Technical Interview': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Telephone Call': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
}

const DATE_COLUMNS: Record<string, string> = {
  'Created Date': 'date',
  'Interview Date': 'interview_date',
  'Project Start Date': 'project_start_date',
  'Project End Date': 'project_end_date',
}

const TEXT_FILTER_COLUMNS: Record<string, string> = {
  'Candidate Name': 'name',
  'Employee': 'employee_name',
  'Status': 'status',
  'Recruiter Organization': 'recruiter_name',
  'Recruiter Email': 'recruiter_email',
  '2nd Up Recruiter': 'organization_name',
  'Implementation Partner': 'implementation_partner',
  'Implementation Partner Email': 'implementation_poc_email',
  'End Client': 'end_client',
  'Interviewer Email': 'interviewer_email',
}

const LOCKABLE_FIELDS = new Set(['name', 'date', 'employee_name', 'backup_employee_name'])

const PAGE_SIZES = [25, 50, 100] as const

const TableRow = memo(function TableRow({
  rec, showEmployeeColumn, isAdmin, readOnly, selectedIds, toggleSelect
}: {
  rec: MarketingRecord
  showEmployeeColumn: boolean
  isAdmin: boolean
  readOnly: boolean
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
}) {
  return (
    <tr className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
      {!readOnly && (
        <td className="px-2 py-3">
          <input type="checkbox" checked={selectedIds.has(rec.id)} onChange={() => toggleSelect(rec.id)}
            onClick={e => e.stopPropagation()} className="accent-[#22c55e] cursor-pointer" />
        </td>
      )}
      <td className="px-4 py-3 text-sm text-white font-medium">{rec.name}</td>
      {showEmployeeColumn && (
        <td className="px-4 py-3 text-sm text-white whitespace-nowrap">{rec.employee_name || 'Unknown employee'}</td>
      )}
      <td className="px-4 py-3 text-sm text-[#a1a1aa] whitespace-nowrap">{rec.backup_employee_name || '—'}</td>
      <td className="px-4 py-3 text-sm text-[#a1a1aa]">{rec.date || '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[rec.status || 'Telephone Call'] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
          {rec.status || 'Telephone Call'}
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
    </tr>
  )
})

export default function MarketingPage({
  isAdmin = false,
  readOnly = false,
  currentUserId: propUserId = null,
  initialRecords: serverRecords = [],
  initialOwnerNames: serverOwnerNames = {},
  employeeOptions = [],
  candidateOptions = [],
}: {
  isAdmin?: boolean
  readOnly?: boolean
  currentUserId?: string | null
  initialRecords?: MarketingRecord[]
  initialOwnerNames?: Record<string, string>
  employeeOptions?: Array<{ id: string; full_name: string }>
  candidateOptions?: Array<{ id: string; name: string; owner_id: string; owner_name?: string | null; status: string | null; backup_employee_id?: string | null; backup_employee_name?: string | null }>
}) {
  const showEmployeeColumn = isAdmin || readOnly
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [records, setRecords] = useState<MarketingRecord[]>(() =>
    serverRecords.map(r => ({ ...r, employee_name: (r.employee_name || serverOwnerNames[r.owner_id] || 'Unknown employee').trim() }))
  )
  const [loading, setLoading] = useState(serverRecords.length === 0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const statusFilterRef = useRef('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null)
  const [dateFilters, setDateFilters] = useState({
    date: { start: '', end: '' },
    interview_date: { start: '', end: '' },
    project_start_date: { start: '', end: '' },
    project_end_date: { start: '', end: '' },
  })
  const [activeTextFilter, setActiveTextFilter] = useState<string | null>(null)
  const [textFilters, setTextFilters] = useState<Record<string, string[]>>({})
  const [textFilterSearch, setTextFilterSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MarketingRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const currentUserIdRef = useRef(propUserId)
  const serverOwnerNamesRef = useRef(serverOwnerNames)
  const [form, setForm] = useState({
    name: '', date: '', recruiter_name: '', recruiter_email: '', organization_name: '',
    implementation_partner: '', end_client: '', status: 'Telephone Call',
    project_start_date: '', project_end_date: '', interview_date: '',
    implementation_poc_email: '', interviewer_email: '', notes: '',
    employee_name: '', backup_employee_name: '',
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState({ status: '', notes: '', recruiter_name: '', organization_name: '', implementation_partner: '', implementation_poc_email: '', end_client: '', interviewer_email: '' })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(50)

  const fetchingRef = useRef(false)
  const fetchedRef = useRef(serverRecords.length > 0)
  const toastRef = useRef(toast)

  useEffect(() => { currentUserIdRef.current = propUserId }, [propUserId])
  useEffect(() => { serverOwnerNamesRef.current = serverOwnerNames }, [serverOwnerNames])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id)))
  }

  const fetchRecords = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (!isAdmin && currentUserIdRef.current) params.set('owner_id', currentUserIdRef.current)
      const qs = params.toString()
      const url = `/api/marketing${qs ? '?' + qs : ''}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error('Failed to load records')
      const json = await res.json()
      const ownerNames = serverOwnerNamesRef.current
      setRecords((json.records || []).map((r: any) => ({ ...r, employee_name: r.employee_name || ownerNames[r.owner_id] || 'Unknown employee' })))
      setPage(0)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toastRef.current.error('Request timed out. Please try again.')
        setError('Request timed out')
      } else {
        toastRef.current.error('Failed to load records.')
        setError(err.message || 'Failed to load records')
      }
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [isAdmin])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchRecords()
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

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value)
    statusFilterRef.current = value
    setPage(0)
  }, [])

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
    if (!activeDateFilter && !activeTextFilter) return
    const handleClick = (e: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
        setActiveDateFilter(null)
        setActiveTextFilter(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeDateFilter, activeTextFilter])

  const canEdit = (record: MarketingRecord) => !readOnly && (isAdmin || record.owner_id === currentUserIdRef.current || (record as any).is_backup_record)

  const openModal = (rec?: MarketingRecord) => {
    if (rec) {
      setEditing(rec)
      setForm({
        name: rec.name, date: rec.date || '', recruiter_name: rec.recruiter_name || '',
        recruiter_email: rec.recruiter_email || '', organization_name: rec.organization_name || '',
        implementation_partner: rec.implementation_partner || '', end_client: rec.end_client || '',
        status: rec.status || 'Telephone Call', project_start_date: rec.project_start_date || '',
        project_end_date: rec.project_end_date || '', interview_date: rec.interview_date || '',
        implementation_poc_email: rec.implementation_poc_email || '',
        interviewer_email: rec.interviewer_email || '', notes: rec.notes || '',
        employee_name: rec.employee_name || '',
        backup_employee_name: rec.backup_employee_name || '',
      })
      setSelectedEmployeeId(isAdmin ? (rec.owner_id || '') : '')
    } else {
      setEditing(null)
      setForm({ name: '', date: todayIST(), recruiter_name: '', recruiter_email: '', organization_name: '', implementation_partner: '', end_client: '', status: 'Telephone Call', project_start_date: '', project_end_date: '', interview_date: '', implementation_poc_email: '', interviewer_email: '', notes: '', employee_name: '', backup_employee_name: '' })
      setSelectedEmployeeId('')
    }
    setError('')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { backup_employee_name: _, ...payloadFields } = form
    const cleanForm = Object.fromEntries(Object.entries(payloadFields).map(([k, v]) => [k, v || null]))
    const payload = editing
      ? { ...cleanForm, id: editing.id, ...(isAdmin && selectedEmployeeId ? { selectedEmployeeId } : {}) }
      : { ...cleanForm, name: form.name, ...(isAdmin && selectedEmployeeId ? { selectedEmployeeId } : {}) }
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

  const handleBulkUpdate = async () => {
    const updates = Object.fromEntries(Object.entries(bulkForm).filter(([_, v]) => v !== ''))
    if (Object.keys(updates).length === 0) { toast.error('No fields to update'); return }
    setBulkSaving(true)
    try {
      const res = await fetch('/api/marketing/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates }),
      })
      if (!res.ok) throw new Error('Failed to bulk update')
      toast.success(`Updated ${selectedIds.size} records`)
      setShowBulkModal(false)
      setSelectedIds(new Set())
      setBulkForm({ status: '', notes: '', recruiter_name: '', organization_name: '', implementation_partner: '', implementation_poc_email: '', end_client: '', interviewer_email: '' })
      fetchRecords()
    } catch {
      toast.error('Failed to bulk update')
    }
    setBulkSaving(false)
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} records?`)) return
    try {
      const res = await fetch('/api/marketing/batch', {
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

        return { ...record, name: record.name || '' }
      })

      const batchRecords = importRows.map(row => {
        const payload: Record<string, any> = { name: row.name || '' }
        for (const key of Object.keys(row)) {
          const val = (row as any)[key]
          if (val !== null && val !== '') payload[key] = val
        }
        return payload
      })

      const res = await fetch('/api/marketing/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: batchRecords }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to import records')

      const errors = result.errors || []
      if (errors.length > 0) {
        const firstFew = errors.slice(0, 5).map((e: any) => `${e.name}: ${e.issues.join(', ')}`)
        const more = errors.length > 5 ? `...and ${errors.length - 5} more` : ''
        setError(`Imported ${result.imported}/${result.total}. Errors:\n${firstFew.join('\n')}${more ? '\n' + more : ''}`)
        toast.error(`Imported ${result.imported}/${result.total} — ${errors.length} row${errors.length === 1 ? '' : 's'} failed`)
      } else {
        toast.success(`Imported ${result.imported} marketing records`)
      }
      fetchRecords()
    } catch (err: any) {
      const message = err.message || 'Failed to import Excel file.'
      setError(message)
      toast.error(message)
    } finally {
      setImporting(false)
    }
  }

  const filteredCandidates = useMemo(() => {
    if (editing) return []
    const available = isAdmin
      ? candidateOptions
      : candidateOptions.filter(c => c.owner_id === currentUserIdRef.current || c.backup_employee_id === currentUserIdRef.current)
    return available.filter(c => c.status !== 'Closed')
  }, [candidateOptions, isAdmin, editing])

  const inRange = (val: string | null, range: { start: string; end: string }) => {
    if (!range.start && !range.end) return true
    if (!val) return false
    const d = val.slice(0, 10)
    if (range.start && d < range.start) return false
    if (range.end && d > range.end) return false
    return true
  }

  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const [header, fieldKey] of Object.entries(TEXT_FILTER_COLUMNS)) {
      const values = new Set<string>()
      for (const rec of records) {
        let val = (rec as any)[fieldKey]
        if (val == null || val === '') val = fieldKey === 'status' ? 'Telephone Call' : null
        if (val != null) values.add(String(val).trim())
      }
      result[header] = Array.from(values).sort((a, b) => a.localeCompare(b))
    }
    return result
  }, [records])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const hasDateFilter = Object.values(dateFilters).some(r => r.start || r.end)
    const hasTextFilter = Object.values(textFilters).some(v => v.length > 0)
    if (!q && statusFilter === 'all' && !hasDateFilter && !hasTextFilter) return records
    return records.filter(r => {
      const displayStatus = r.status || 'Telephone Call'
      if (statusFilter !== 'all' && displayStatus !== statusFilter) return false
      if (!inRange(r.date, dateFilters.date)) return false
      if (!inRange(r.interview_date, dateFilters.interview_date)) return false
      if (!inRange(r.project_start_date, dateFilters.project_start_date)) return false
      if (!inRange(r.project_end_date, dateFilters.project_end_date)) return false
      for (const [header, selected] of Object.entries(textFilters)) {
        if (selected.length === 0) continue
        const fieldKey = TEXT_FILTER_COLUMNS[header] || header.toLowerCase()
        let fieldVal = String((r as any)[fieldKey] ?? '').trim()
        if (!fieldVal && fieldKey === 'status') fieldVal = 'Telephone Call'
        if (!selected.includes(fieldVal)) return false
      }
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
  }, [records, search, statusFilter, dateFilters, textFilters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = useMemo(() => {
    const start = page * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(0)
  }, [page, totalPages])

  const exportCSV = useCallback(() => {
    const headers = ['Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Backup Employee', 'Created Date', 'Status', 'Recruiter Organization', 'Recruiter Email', '2nd Up Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Project End Date', 'Comments', ...(isAdmin ? ['Last Reminder'] : [])]
    const rows = filtered.map(r => [r.name, ...(showEmployeeColumn ? [r.employee_name] : []), r.backup_employee_name, r.date, r.status, r.recruiter_name, r.recruiter_email, r.organization_name, r.implementation_partner, r.implementation_poc_email, r.end_client, r.interview_date, r.interviewer_email, r.project_start_date, r.project_end_date, r.notes, ...(isAdmin ? [r.last_reminder_sent_at] : [])])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'marketing_records.csv'; a.click()
    setShowExportMenu(false)
  }, [filtered, showEmployeeColumn, isAdmin])

  const exportPDF = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape' })

    const headers = ['Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Backup Employee', 'Created Date', 'Status', 'Recruiter Organization', 'Recruiter Email', '2nd Up Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Project End Date', 'Comments', ...(isAdmin ? ['Last Reminder'] : [])]
    const data = filtered.map(r => [r.name, ...(showEmployeeColumn ? [r.employee_name || ''] : []), r.backup_employee_name || '', r.date || '', r.status || '', r.recruiter_name || '', r.recruiter_email || '', r.organization_name || '', r.implementation_partner || '', r.implementation_poc_email || '', r.end_client || '', r.interview_date || '', r.interviewer_email || '', r.project_start_date || '', r.project_end_date || '', r.notes || '', ...(isAdmin ? [r.last_reminder_sent_at ? new Date(r.last_reminder_sent_at).toLocaleString() : ''] : [])])

    autoTable(doc, {
      head: [headers],
      body: data,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 197, 94] },
    })

    doc.save('marketing_records.pdf')
    setShowExportMenu(false)
  }, [filtered, showEmployeeColumn, isAdmin])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 space-y-4 mb-4">
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
        <input type="text" placeholder="Search records..." value={searchInput} onChange={e => handleSearchChange(e.target.value)}
          suppressHydrationWarning
          className="flex-1 min-w-[200px] bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#3a3a3a] focus:outline-none focus:border-[#22c55e]/60" />
        <select value={statusFilter} onChange={e => handleStatusFilterChange(e.target.value)}
          suppressHydrationWarning
          className="bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
          <option value="all">All Status</option>
          <option value="Initial Screening">Initial Screening</option>
          <option value="Introductory call">Introductory call</option>
          <option value="Project Received">Project Received</option>
          <option value="RTR Confirmed">RTR Confirmed</option>
          <option value="Screening Call">Screening Call</option>
          <option value="Technical Interview">Technical Interview</option>
          <option value="Telephone Call">Telephone Call</option>
        </select>
        {Object.values(dateFilters).some(r => r.start || r.end) || Object.values(textFilters).some(v => v.length > 0) ? (
          <button onClick={() => { setDateFilters({ date: { start: '', end: '' }, interview_date: { start: '', end: '' }, project_start_date: { start: '', end: '' }, project_end_date: { start: '', end: '' } }); setActiveDateFilter(null); setTextFilters({}); setActiveTextFilter(null) }} suppressHydrationWarning
            className="text-xs text-[#71717a] hover:text-red-400 transition-colors px-2">
            Clear all filters
          </button>
        ) : null}
      </div>

      {/* Bulk Actions */}
      {!readOnly && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5">
          <span className="text-sm text-[#a1a1aa]">{selectedIds.size} selected</span>
          <button onClick={() => {
            if (selectedIds.size === 1) {
              const id = Array.from(selectedIds)[0]
              const rec = records.find(r => r.id === id) || filtered.find(r => r.id === id)
              if (rec) { openModal(rec); setSelectedIds(new Set()); return }
            }
            setBulkForm({ status: '', notes: '', recruiter_name: '', organization_name: '', implementation_partner: '', implementation_poc_email: '', end_client: '', interviewer_email: '' }); setShowBulkModal(true)
          }} className="text-xs bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/20 px-3 py-1.5 rounded-lg transition-all">Edit Selected</button>
          {isAdmin && <button onClick={handleBulkDelete} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition-all">Delete Selected</button>}
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#71717a] hover:text-white ml-auto transition-colors">Clear selection</button>
        </div>
      )}
      </div>

      {/* Table */}
      <div className={`flex-1 flex flex-col bg-[#111111] border border-[#2a2a2a] rounded-2xl ${(activeDateFilter || activeTextFilter) ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className={`flex-1 ${(activeDateFilter || activeTextFilter) ? 'overflow-hidden' : 'overflow-auto'}`}>
          <table className="w-full">
            <thead ref={dateFilterRef} className="sticky top-0 z-10 bg-[#111111]">
              <tr className="border-b border-[#2a2a2a]">
                {[...(!readOnly ? ['SELECT' as const] : []), 'Candidate Name', ...(showEmployeeColumn ? ['Employee'] : []), 'Backup Employee', 'Created Date', 'Status', 'Recruiter Organization', 'Recruiter Email', '2nd Up Recruiter', 'Implementation Partner', 'Implementation Partner Email', 'End Client', 'Interview Date', 'Interviewer Email', 'Project Start Date', 'Project End Date', 'Comments', isAdmin ? 'Last Reminder' : ''].filter(Boolean).map(h => {
                  if (h === 'SELECT') {
                    return (
                      <th key="select" className="text-left px-2 py-3 w-10">
                        <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                          className="accent-[#22c55e] cursor-pointer" />
                      </th>
                    )
                  }
                  const dateKey = DATE_COLUMNS[h]
                  const textKey = TEXT_FILTER_COLUMNS[h]
                  const isFilterable = dateKey || textKey
                  const dateIsActive = dateKey && activeDateFilter === dateKey
                  const textIsActive = textKey && activeTextFilter === h
                  const dateHasFilter = dateKey && !!(dateFilters[dateKey as keyof typeof dateFilters]?.start || dateFilters[dateKey as keyof typeof dateFilters]?.end)
                  const textHasFilter = textKey && (textFilters[h]?.length ?? 0) > 0
                  return (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap relative">
                      {isFilterable ? (
                        <div className="flex items-center gap-1.5">
                          <span>{h}</span>
                          <button ref={dateKey && dateKey === activeDateFilter ? (el) => { dateFilterBtnRef.current = el } : undefined}
                            onClick={(e) => { e.stopPropagation(); if (dateKey) { setActiveDateFilter(dateIsActive ? null : dateKey); setActiveTextFilter(null) } else { setActiveTextFilter(textIsActive ? null : h); setActiveDateFilter(null) } }}
                            className={`p-0.5 rounded transition-colors ${(dateHasFilter || textHasFilter) ? 'text-[#22c55e]' : 'text-[#3a3a3a] hover:text-[#a1a1aa]'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                          </button>
                        </div>
                      ) : h}
                      {dateKey && dateIsActive && (
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
                              {dateHasFilter && (
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
                    {Array.from({ length: 14 + (showEmployeeColumn ? 1 : 0) + (isAdmin ? 1 : 0) + (!readOnly ? 1 : 0) }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={14 + (showEmployeeColumn ? 1 : 0) + (isAdmin ? 1 : 0) + (!readOnly ? 2 : 0)} className="px-4 py-12 text-center">
                  <div className="text-red-400 text-sm mb-1">Failed to load records</div>
                  <div className="text-[#71717a] text-xs">{error.includes('timed') ? 'The request timed out. Try refreshing the page.' : 'Please check your connection and try again.'}</div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={15 + (showEmployeeColumn ? 1 : 0) + (isAdmin ? 1 : 0) + (!readOnly ? 2 : 0)} className="px-4 py-12 text-center text-[#71717a] text-sm">No records found.</td></tr>
              ) : (
                paginated.map(rec => (
                  <TableRow key={rec.id} rec={rec} showEmployeeColumn={showEmployeeColumn} isAdmin={isAdmin} readOnly={readOnly} selectedIds={selectedIds} toggleSelect={toggleSelect} />
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
            <span>Showing {(page * pageSize) + 1}-{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} records</span>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">{editing ? 'Edit Record' : 'Add Marketing Record'}</h2>
            <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
              {isAdmin && !editing && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Primary Employee *</label>
                  <select value={selectedEmployeeId} onChange={e => {
                    const empId = e.target.value
                    setSelectedEmployeeId(empId)
                    const emp = employeeOptions.find(e => e.id === empId)
                    setForm({ ...form, employee_name: emp?.full_name || '' })
                  }} required disabled={!!form.name && !!selectedEmployeeId}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 disabled:opacity-50 disabled:cursor-not-allowed">
                    <option value="">Select Primary Employee</option>
                    {employeeOptions.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
              {isAdmin && editing && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Primary Employee</label>
                  <input type="text" value={form.employee_name || ''} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white opacity-50 cursor-not-allowed" />
                </div>
              )}
              {!isAdmin && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Primary Employee</label>
                  <input type="text" value={form.employee_name || ''} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white opacity-50 cursor-not-allowed" />
                </div>
              )}
              {isAdmin ? (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Backup Employee</label>
                  <input type="text" value={form.backup_employee_name || ''} onChange={e => setForm({ ...form, backup_employee_name: e.target.value })}
                    disabled={!!form.name && !!form.backup_employee_name}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 disabled:opacity-50 disabled:cursor-not-allowed" />
                </div>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Backup Employee</label>
                  <input type="text" value={form.backup_employee_name || ''} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white opacity-50 cursor-not-allowed" />
                </div>
              )}
              {!editing ? (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Candidate Name *</label>
                  <select value={form.name} onChange={e => {
                    const name = e.target.value
                    const candidate = candidateOptions.find(c => c.name === name)
                    let empName = '', backupName = '', empId = ''
                    if (candidate) {
                      if (candidate.owner_name) {
                        empName = candidate.owner_name
                      } else if (candidate.owner_id) {
                        const emp = employeeOptions.find(e => e.id === candidate.owner_id)
                        if (emp) empName = emp.full_name
                      }
                      backupName = candidate.backup_employee_name || ''
                      empId = candidate.owner_id || ''
                    }
                    setForm({ ...form, name, employee_name: empName, backup_employee_name: backupName })
                    if (isAdmin) setSelectedEmployeeId(empId)
                  }} required
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]/60">
                    <option value="">Select Candidate</option>
                    {filteredCandidates.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Candidate Name</label>
                  <input type="text" value={form.name} disabled
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-white opacity-50 cursor-not-allowed" />
                </div>
              )}
              {[
                { label: 'Created Date', name: 'date', type: 'date', span: 1 },
                { label: 'Status', name: 'status', type: 'select', options: ['Initial Screening', 'Introductory call', 'Project Received', 'RTR Confirmed', 'Screening Call', 'Technical Interview', 'Telephone Call'], span: 1 },
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
                const locked = field.name === 'date' || (!!editing && (LOCKABLE_FIELDS.has(field.name) && !!form[field.name as keyof typeof form]))
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
                    <input type={field.type} value={form[field.name as keyof typeof form] || ''} onChange={e => setForm({ ...form, [field.name]: e.target.value })} disabled={locked}
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

      {/* Bulk Edit Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-1">Bulk Edit ({selectedIds.size} records)</h2>
            <p className="text-xs text-[#71717a] mb-5">Only filled fields will be updated.</p>
            <div className="space-y-3">
              {[
                { label: 'Status', name: 'status', type: 'select', options: ['', 'Initial Screening', 'Introductory call', 'Project Received', 'RTR Confirmed', 'Screening Call', 'Technical Interview', 'Telephone Call'] },
                { label: 'Notes', name: 'notes', type: 'textarea' },
                { label: 'Recruiter Name', name: 'recruiter_name', type: 'text' },
                { label: '2nd Up Recruiter', name: 'organization_name', type: 'text' },
                { label: 'Implementation Partner', name: 'implementation_partner', type: 'text' },
                { label: 'Implementation POC Email', name: 'implementation_poc_email', type: 'email' },
                { label: 'End Client', name: 'end_client', type: 'text' },
                { label: 'Interviewer Email', name: 'interviewer_email', type: 'email' },
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
