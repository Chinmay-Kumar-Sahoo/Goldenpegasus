'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import PageHeader from '@/components/PageHeader'
import toast from 'react-hot-toast'

interface FieldDef { name: string; label: string; type: string; required: boolean }
interface DynamicTable {
  id: string
  table_name: string
  description: string | null
  schema_definition: FieldDef[]
  is_global: boolean
  owner_id: string
  created_at: string
}
interface TableRecord { id: string; table_id: string; owner_id: string; data: Record<string, unknown>; created_at: string }
interface Profile { id: string; full_name: string; email: string }
interface Permission { id: string; table_id: string; user_id: string; permission: string; profiles?: { full_name: string; email: string } }

const FIELD_TYPES = ['text', 'number', 'email', 'date', 'textarea', 'select']

export default function DynamicTablesPage({ isAdmin = false, initialTables = [], initialUserId = null }: { isAdmin?: boolean; initialTables?: DynamicTable[]; initialUserId?: string | null }) {
  const [tables, setTables] = useState<DynamicTable[]>(initialTables)
  const [loading, setLoading] = useState(initialTables.length === 0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId)
  const [activeTable, setActiveTable] = useState<DynamicTable | null>(null)
  const [records, setRecords] = useState<TableRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [showPermModal, setShowPermModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TableRecord | null>(null)
  const [recordForm, setRecordForm] = useState<Record<string, string>>({})
  const [newTableForm, setNewTableForm] = useState({ table_name: '', description: '', is_global: false })
  const [fields, setFields] = useState<FieldDef[]>([{ name: 'field1', label: 'Field 1', type: 'text', required: false }])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const api = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Request failed')
    return json
  }

  const fetchTables = useCallback(async () => {
    setLoading(true)
    try {
      const json = await api('/api/tables?action=tables')
      setTables(json.tables || [])
    } catch { setTables([]) }
    setLoading(false)
  }, [])

  const fetchedRef = useRef(initialTables.length > 0)

  useEffect(() => {
    ;(async () => {
      if (!fetchedRef.current) {
        fetchedRef.current = true
        fetchTables()
      }
      try {
        const json = await api('/api/tables?action=profiles')
        setAllUsers(json.profiles || [])
      } catch {}
    })()
  }, [fetchTables])

  const openTable = async (table: DynamicTable) => {
    setActiveTable(table)
    setRecordsLoading(true)
    try {
      const json = await api(`/api/tables?action=records&table_id=${table.id}`)
      setRecords(json.records || [])
    } catch { setRecords([]) }
    setRecordsLoading(false)

    try {
      const json = await api(`/api/tables?action=permissions&table_id=${table.id}`)
      setPermissions(json.permissions || [])
    } catch { setPermissions([]) }
  }

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'table', table_name: newTableForm.table_name, description: newTableForm.description, schema_definition: fields, is_global: isAdmin ? newTableForm.is_global : false }),
      })
      setShowTableModal(false)
      setNewTableForm({ table_name: '', description: '', is_global: false })
      setFields([{ name: 'field1', label: 'Field 1', type: 'text', required: false }])
      toast.success('Table created successfully')
      fetchTables()
    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to create table')
    }
    setSaving(false)
  }

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Delete this table and all its records?')) return
    try {
      await api('/api/tables', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'table', id }) })
      if (activeTable?.id === id) setActiveTable(null)
      toast.success('Table deleted')
      fetchTables()
    } catch { toast.error('Failed to delete table') }
  }

  const openRecordModal = (rec?: TableRecord) => {
    if (!activeTable) return
    if (rec) {
      setEditingRecord(rec)
      setRecordForm(Object.fromEntries(activeTable.schema_definition.map(f => [f.name, String(rec.data[f.name] || '')])))
    } else {
      setEditingRecord(null)
      setRecordForm(Object.fromEntries(activeTable.schema_definition.map(f => [f.name, ''])))
    }
    setShowRecordModal(true)
  }

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record', id: editingRecord?.id, table_id: activeTable!.id, data: recordForm }),
      })
      toast.success(editingRecord ? 'Record updated' : 'Record added')
      setShowRecordModal(false)
      if (activeTable) openTable(activeTable)
    } catch (err: any) {
      setError(err.message)
      toast.error('Failed to save record')
    }
    setSaving(false)
  }

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Delete this record?')) return
    try {
      await api('/api/tables', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'record', id }) })
      toast.success('Record deleted')
      if (activeTable) openTable(activeTable)
    } catch { toast.error('Failed to delete record') }
  }

  const handleGrantPermission = async (userId: string, permission: string) => {
    if (!activeTable) return
    setPermissions(prev => {
      const filtered = prev.filter(p => p.user_id !== userId)
      if (permission) return [...filtered, { id: 'opt-' + Date.now(), table_id: activeTable.id, user_id: userId, permission }]
      return filtered
    })
    setSaving(true)
    try {
      await api('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'permission', table_id: activeTable.id, user_id: userId, permission }),
      })
      toast.success(permission ? `Permission set to ${permission}` : 'Access revoked')
    } catch (err: any) {
      toast.error('Failed: ' + err.message)
      setPermissions(prev => prev.filter(p => p.user_id !== userId))
    }
    setSaving(false)
  }

  const handleRevokePermission = async (userId: string) => {
    if (!activeTable) return
    const existingPerm = permissions.find(p => p.user_id === userId)
    if (!existingPerm) return
    setPermissions(prev => prev.filter(p => p.user_id !== userId))
    setSaving(true)
    try {
      await api('/api/tables', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'permission', id: existingPerm.id }) })
    } catch { }
    setSaving(false)
  }

  const addField = () => setFields([...fields, { name: `field${fields.length + 1}`, label: `Field ${fields.length + 1}`, type: 'text', required: false }])
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i))
  const updateField = (i: number, key: keyof FieldDef, value: string | boolean) => {
    const updated = [...fields]
    updated[i] = { ...updated[i], [key]: value }
    setFields(updated)
  }

  const canManageTable = (table: DynamicTable) => isAdmin || table.owner_id === currentUserId
  const canEditData = (table: DynamicTable) => {
    if (canManageTable(table)) return true
    return permissions.some(p => p.user_id === currentUserId && p.permission === 'edit')
  }
  const hasAnyAccess = (table: DynamicTable) => {
    if (canManageTable(table)) return true
    return permissions.some(p => p.user_id === currentUserId)
  }

  return (
    <div>
      <PageHeader title={isAdmin ? 'Dynamic Tables' : 'Custom Tables'} subtitle={isAdmin ? 'Create and manage global tables' : 'Your private and shared tables'}>
        <button onClick={() => setShowTableModal(true)} className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">+ New Table</button>
      </PageHeader>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tables List */}
        <div className="lg:col-span-1 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)
          ) : tables.length === 0 ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 text-center">
              <div className="text-3xl mb-3">🏗️</div>
              <p className="text-sm text-[#71717a]">No tables yet. Create your first one!</p>
            </div>
          ) : (
            tables.map(table => (
              <div key={table.id}
                onClick={() => openTable(table)}
                className={`bg-[#111111] border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${activeTable?.id === table.id ? 'border-[#22c55e]/50 bg-[#1a1a1a]' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm truncate">{table.table_name}</div>
                    {table.description && <div className="text-xs text-[#71717a] mt-0.5 truncate">{table.description}</div>}
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-0.5 rounded-full">
                        {table.schema_definition?.length || 0} fields
                      </span>
                      {table.is_global && <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Global</span>}
                    </div>
                  </div>
                  {canManageTable(table) && (
                    <button onClick={e => { e.stopPropagation(); handleDeleteTable(table.id) }}
                      className="text-xs text-[#71717a] hover:text-red-400 transition-colors flex-shrink-0">✕</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Table Records Viewer */}
        <div className="lg:col-span-2">
          {!activeTable ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-12 text-center">
              <div className="text-4xl mb-4">👈</div>
              <p className="text-[#71717a]">Select a table to view its records</p>
            </div>
          ) : (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl">
              <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{activeTable.table_name}</div>
                  {activeTable.description && <div className="text-xs text-[#71717a]">{activeTable.description}</div>}
                </div>
                <div className="flex gap-2">
                  {canManageTable(activeTable) && (
                    <button onClick={() => setShowPermModal(true)} className="text-xs border border-[#2a2a2a] hover:bg-[#1a1a1a] text-[#a1a1aa] hover:text-white px-3 py-1.5 rounded-lg transition-all">
                      🔐 Permissions
                    </button>
                  )}
                  {canEditData(activeTable) && (
                    <button onClick={() => openRecordModal()} className="text-xs bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-3 py-1.5 rounded-lg transition-all">
                      + Add Row
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2a2a2a]">
                      {activeTable.schema_definition.map(f => (
                        <th key={f.name} className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide whitespace-nowrap">{f.label}</th>
                      ))}
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Added</th>
                      {canEditData(activeTable) && <th className="px-4 py-3 text-xs font-medium text-[#71717a] uppercase tracking-wide">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {recordsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b border-[#1a1a1a]">
                          {Array.from({ length: activeTable.schema_definition.length + 2 }).map((_, j) => (
                            <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : records.length === 0 ? (
                      <tr><td colSpan={activeTable.schema_definition.length + 2} className="px-4 py-12 text-center text-[#71717a] text-sm">No records yet.</td></tr>
                    ) : (
                      records.map(rec => (
                        <tr key={rec.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                          {activeTable.schema_definition.map(f => (
                            <td key={f.name} className="px-4 py-3 text-sm text-[#a1a1aa]">{String(rec.data[f.name] || '—')}</td>
                          ))}
                          <td className="px-4 py-3 text-xs text-[#71717a]">{new Date(rec.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            {canEditData(activeTable) && (
                              <div className="flex gap-2">
                                <button onClick={() => openRecordModal(rec)} className="text-xs border border-[#2a2a2a] hover:bg-[#22c55e]/10 hover:text-[#22c55e] px-2 py-1 rounded-lg transition-all text-[#a1a1aa]">Edit</button>
                                <button onClick={() => handleDeleteRecord(rec.id)} className="text-xs border border-[#2a2a2a] hover:bg-red-500/10 hover:text-red-400 px-2 py-1 rounded-lg transition-all text-[#a1a1aa]">Del</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-[#2a2a2a] text-xs text-[#71717a]">{records.length} records</div>
            </div>
          )}
        </div>
      </div>

      {/* Create Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">Create New Table</h2>
            <form onSubmit={handleCreateTable} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Table Name *</label>
                <input type="text" value={newTableForm.table_name} onChange={e => setNewTableForm({ ...newTableForm, table_name: e.target.value })} required placeholder="My Custom Table"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">Description</label>
                <input type="text" value={newTableForm.description} onChange={e => setNewTableForm({ ...newTableForm, description: e.target.value })} placeholder="Optional description"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
              </div>
              {isAdmin && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={newTableForm.is_global} onChange={e => setNewTableForm({ ...newTableForm, is_global: e.target.checked })}
                    className="w-4 h-4 accent-[#22c55e]" />
                  <span className="text-sm text-[#a1a1aa]">Make this a Global Table (visible to all employees)</span>
                </label>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-[#a1a1aa]">Fields</label>
                  <button type="button" onClick={addField} className="text-xs text-[#22c55e] hover:text-[#4ade80] transition-colors">+ Add Field</button>
                </div>
                <div className="space-y-3">
                  {fields.map((field, i) => (
                    <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={field.label} onChange={e => updateField(i, 'label', e.target.value)} placeholder="Field Label"
                          className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22c55e]/60" />
                        <input type="text" value={field.name} onChange={e => updateField(i, 'name', e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="field_key"
                          className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#22c55e]/60" />
                        <select value={field.type} onChange={e => updateField(i, 'type', e.target.value)}
                          className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                          {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => removeField(i)} className="text-[#71717a] hover:text-red-400 text-xs transition-colors">✕</button>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[#71717a] cursor-pointer">
                        <input type="checkbox" checked={field.required} onChange={e => updateField(i, 'required', e.target.checked)} className="w-3 h-3 accent-[#22c55e]" />
                        Required
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowTableModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Record Modal */}
      {showRecordModal && activeTable && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-6">{editingRecord ? 'Edit Record' : 'Add Record'}</h2>
            <form onSubmit={handleSaveRecord} className="space-y-4">
              {activeTable.schema_definition.map(field => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1.5">{field.label}{field.required && ' *'}</label>
                  {field.type === 'textarea' ? (
                    <textarea value={recordForm[field.name] || ''} onChange={e => setRecordForm({ ...recordForm, [field.name]: e.target.value })} required={field.required} rows={3}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60 resize-none" />
                  ) : (
                    <input type={field.type === 'select' ? 'text' : field.type} value={recordForm[field.name] || ''} onChange={e => setRecordForm({ ...recordForm, [field.name]: e.target.value })} required={field.required}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#22c55e]/60" />
                  )}
                </div>
              ))}
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRecordModal(false)} className="flex-1 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermModal && activeTable && canManageTable(activeTable) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-2">Manage Permissions</h2>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-[#71717a]">{activeTable.table_name}</p>
              <div className="text-[10px] text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full">
                {permissions.length} perms loaded
              </div>
            </div>
            <div className="space-y-3">
              {allUsers.filter(u => u.id !== currentUserId).map(user => {
                const perm = permissions.find(p => p.user_id?.toLowerCase() === user.id?.toLowerCase())
                return (
                  <div key={user.id} className="flex items-center justify-between gap-3 bg-[#1a1a1a] rounded-xl p-3">
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{user.full_name}</div>
                      <div className="text-xs text-[#71717a] truncate">{user.email}</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                  <select
                    value={perm?.permission || ''}
                    onChange={e => {
                      const val = e.target.value
                      if (val) {
                        handleGrantPermission(user.id, val)
                      } else {
                        handleRevokePermission(user.id)
                      }
                    }}
                    className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="">No Access</option>
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                  </select>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setShowPermModal(false)} className="mt-6 w-full border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white py-2.5 rounded-xl text-sm transition-all">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
