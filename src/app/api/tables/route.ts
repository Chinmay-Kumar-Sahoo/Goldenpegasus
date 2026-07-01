import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

let _adminClient: ReturnType<typeof createAdminClient> | null = null
function getAdminClient() {
  if (_adminClient) return _adminClient
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (key) _adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _adminClient
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'tables'
  const tableId = searchParams.get('table_id')

  if (action === 'tables') {
    const { data, error } = await supabase
      .from('dynamic_tables')
      .select('*')
      .neq('table_name', 'My Project Records')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tables: data || [] })
  }

  if (action === 'records' && tableId) {
    const { data: table } = await supabase
      .from('dynamic_tables')
      .select('schema_definition')
      .eq('id', tableId)
      .single()
    const schemaFields = (table?.schema_definition || []) as any[]
    const { data, error } = await supabase
      .from('dynamic_table_records')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Remap orphaned data keys to current schema field names by position
    const records = (data || []).map(rec => {
      const recordData = rec.data as Record<string, any> || {}
      const schemaNames = new Set(schemaFields.map((f: any) => f.name))
      const orphanKeys = Object.keys(recordData).filter(k => !schemaNames.has(k))
      if (orphanKeys.length === 0) return rec
      const newData = { ...recordData }
      for (let i = 0; i < schemaFields.length; i++) {
        const fieldName = schemaFields[i].name
        if (!(fieldName in newData)) {
          const candidateOrphan = orphanKeys.find(k => {
            const m = k.match(/^field(\d+)$/)
            return m && parseInt(m[1], 10) - 1 === i
          })
          if (candidateOrphan) {
            newData[fieldName] = newData[candidateOrphan]
            delete newData[candidateOrphan]
          }
        }
      }
      return { ...rec, data: newData }
    })
    return NextResponse.json({ records })
  }

  if (action === 'permissions' && tableId) {
    const { data, error } = await supabase
      .from('table_permissions')
      .select('*')
      .eq('table_id', tableId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ permissions: data || [] })
  }

  if (action === 'profiles') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ profiles: data || [] })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = body.action || 'table'

  if (action === 'cleanup') {
    const adminClient = getAdminClient()
    if (!adminClient) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    const { data: tables } = await (adminClient.from('dynamic_tables') as any).select('id, schema_definition')
    if (!tables) return NextResponse.json({ success: true, cleaned: 0 })
    let totalCleaned = 0
    for (const table of tables) {
      const schema = (table.schema_definition || []) as any[]
      const { data: records } = await (adminClient.from('dynamic_table_records') as any).select('id, data').eq('table_id', table.id)
      if (!records) continue
      for (const rec of records) {
        let changed = false
        const newData = { ...rec.data as Record<string, any> }
        for (const field of schema) {
          const val = newData[field.name]
          if (!val || typeof val !== 'string') continue
          if (field.type === 'text') {
            const cleaned = val.replace(/[^a-zA-Z\s]/g, '')
            if (cleaned !== val) { newData[field.name] = cleaned; changed = true }
          } else if (field.type === 'email') {
            const cleaned = val.replace(/\s/g, '')
            if (cleaned !== val) { newData[field.name] = cleaned; changed = true }
          }
        }
        if (changed) {
          await (adminClient.from('dynamic_table_records') as any).update({ data: newData, updated_at: new Date().toISOString() }).eq('id', rec.id)
          totalCleaned++
        }
      }
    }
    return NextResponse.json({ success: true, cleaned: totalCleaned })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (action === 'fix_orphaned') {
    let totalFixed = 0
    const { data: tables } = await supabase.from('dynamic_tables').select('id, schema_definition')
    if (!tables) return NextResponse.json({ success: true, fixed: 0 })
    for (const table of tables) {
      const schema = (table.schema_definition || []) as any[]
      const validNames = new Set(schema.map((f: any) => f.name))
      const { data: records } = await supabase.from('dynamic_table_records').select('id, data').eq('table_id', table.id)
      if (!records) continue
      for (const rec of records) {
        const recData = rec.data as Record<string, any> || {}
        const orphanKeys = Object.keys(recData).filter(k => !validNames.has(k))
        if (orphanKeys.length === 0) continue
        const newData = { ...recData }
        let changed = false
        // Map orphaned field\d+ keys to current schema field names by position
        for (let i = 0; i < schema.length; i++) {
          const fieldName = schema[i].name
          if (fieldName in newData) continue
          const match = orphanKeys.find(k => {
            const m = k.match(/^field(\d+)$/)
            return m && parseInt(m[1], 10) - 1 === i
          })
          if (match) {
            newData[fieldName] = newData[match]
            delete newData[match]
            changed = true
          }
        }
        // Also handle any remaining orphan keys by position order
        if (!changed && orphanKeys.length > 0) {
          const remainingOrphans = orphanKeys.sort()
          for (let i = 0; i < Math.min(schema.length, remainingOrphans.length); i++) {
            if (!(schema[i].name in newData)) {
              newData[schema[i].name] = newData[remainingOrphans[i]]
              delete newData[remainingOrphans[i]]
              changed = true
            }
          }
        }
        if (changed) {
          await supabase.from('dynamic_table_records').update({ data: newData, updated_at: new Date().toISOString() }).eq('id', rec.id)
          totalFixed++
        }
      }
    }
    return NextResponse.json({ success: true, fixed: totalFixed })
  }

  if (action === 'update_table') {
    const { data: existing } = await supabase
      .from('dynamic_tables')
      .select('owner_id, schema_definition')
      .eq('id', body.id)
      .single()
    if (!existing) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    const isAdminResult = await supabase.rpc('is_admin')
    const isAdmin = isAdminResult.data ?? false
    if (existing.owner_id !== user.id && !isAdmin)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const oldSchema = (existing.schema_definition || []) as any[]
    const newSchema = (body.schema_definition || []) as any[]
    // Build name migration map by position (oldName -> newName)
    const renameMap: Record<string, string> = {}
    for (let i = 0; i < Math.min(oldSchema.length, newSchema.length); i++) {
      if (oldSchema[i].name !== newSchema[i].name) {
        renameMap[oldSchema[i].name] = newSchema[i].name
      }
    }
    if (Object.keys(renameMap).length > 0) {
      const { data: records } = await supabase.from('dynamic_table_records').select('id, data').eq('table_id', body.id)
      if (records) {
        for (const rec of records) {
          const data = rec.data as Record<string, any> || {}
          let newData = { ...data }
          let changed = false
          for (const [oldKey, newKey] of Object.entries(renameMap)) {
            if (oldKey in data && !(newKey in data)) {
              newData[newKey] = data[oldKey]
              delete newData[oldKey]
              changed = true
            }
          }
          if (changed) {
            await supabase.from('dynamic_table_records').update({ data: newData, updated_at: new Date().toISOString() }).eq('id', rec.id)
          }
        }
      }
    }
    const { error } = await supabase
      .from('dynamic_tables')
      .update({
        table_name: body.table_name,
        description: body.description || null,
        schema_definition: body.schema_definition,
        is_global: body.is_global || false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'updated', entity_type: 'dynamic_table', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  if (action === 'table') {
    const { data: inserted, error } = await supabase.from('dynamic_tables').insert({
      owner_id: user.id,
      table_name: body.table_name,
      description: body.description || null,
      schema_definition: body.schema_definition,
      is_global: body.is_global || false,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'created', entity_type: 'dynamic_table', entity_id: inserted.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  if (action === 'record') {
    if (body.table_id) {
      const { data: table } = await supabase.from('dynamic_tables').select('schema_definition, owner_id').eq('id', body.table_id).single()
      if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

      // Permission check: owner, admin, or user with 'edit' permission
      const isOwner = table.owner_id === user.id
      const isAdminResult = await supabase.rpc('is_admin')
      const isAdmin = isAdminResult.data ?? false
      if (!isOwner && !isAdmin) {
        const { data: perm } = await supabase
          .from('table_permissions')
          .select('permission')
          .eq('table_id', body.table_id)
          .eq('user_id', user.id)
          .maybeSingle()
        if (!perm || perm.permission !== 'edit') {
          return NextResponse.json({ error: 'Forbidden: you do not have edit permission on this table' }, { status: 403 })
        }
      }

      if (table?.schema_definition) {
        for (const field of table.schema_definition as any[]) {
          const val = body.data[field.name]
          if (val) {
            if (field.type === 'text' && !/^[a-zA-Z\s]*$/.test(val)) {
              return NextResponse.json({ error: `${field.label} must only contain letters and spaces` }, { status: 400 })
            }
            if (field.type === 'number' && !/^\d*\.?\d*$/.test(val)) {
              return NextResponse.json({ error: `${field.label} must be a valid number` }, { status: 400 })
            }
            if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(val)) {
              return NextResponse.json({ error: `${field.label} must be a valid email address` }, { status: 400 })
            }
          }
        }
      }
    }
    if (body.id) {
      // Merge update with existing record data so unfilled fields aren't wiped
      const { data: existingRec } = await supabase
        .from('dynamic_table_records')
        .select('data')
        .eq('id', body.id)
        .single()
      const existingData = existingRec?.data as Record<string, any> || {}
      let mergedData = { ...existingData, ...body.data }
      // Clean up orphaned keys (e.g. field1) that don't match current schema field names
      if (body.table_id) {
        const { data: schemaTable } = await supabase.from('dynamic_tables').select('schema_definition').eq('id', body.table_id).single()
        const schemaFields = (schemaTable?.schema_definition || []) as any[]
        const validNames = new Set(schemaFields.map((f: any) => f.name))
        for (const key of Object.keys(mergedData)) {
          if (validNames.has(key)) continue
          const m = key.match(/^field(\d+)$/)
          if (m) {
            const idx = parseInt(m[1], 10) - 1
            if (idx >= 0 && idx < schemaFields.length && !(schemaFields[idx].name in mergedData)) {
              mergedData[schemaFields[idx].name] = mergedData[key]
            }
          }
          delete mergedData[key]
        }
      }
      const { error } = await supabase
        .from('dynamic_table_records')
        .update({ data: mergedData, updated_at: new Date().toISOString() })
        .eq('id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabase.from('audit_logs').insert({ action: 'updated', entity_type: 'dynamic_table_record', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
      return NextResponse.json({ success: true })
    }
    const { data: inserted, error } = await supabase.from('dynamic_table_records').insert({
      table_id: body.table_id,
      owner_id: user.id,
      data: body.data,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'created', entity_type: 'dynamic_table_record', entity_id: inserted.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  if (action === 'permission') {
    const { data: existing } = await supabase
      .from('table_permissions')
      .select('id, permission')
      .eq('table_id', body.table_id)
      .eq('user_id', body.user_id)
      .maybeSingle()

    if (existing) {
      if (!body.permission) {
        await supabase.from('table_permissions').delete().eq('id', existing.id)
        await supabase.from('audit_logs').insert({ action: 'deleted', entity_type: 'table_permission', entity_id: existing.id, user_id: user.id, created_at: new Date().toISOString() })
      } else {
        const { error } = await supabase
          .from('table_permissions')
          .update({ permission: body.permission, granted_by: user.id })
          .eq('id', existing.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        await supabase.from('audit_logs').insert({ action: 'updated', entity_type: 'table_permission', entity_id: existing.id, user_id: user.id, created_at: new Date().toISOString() })
      }
    } else if (body.permission) {
      const { data: inserted, error } = await supabase.from('table_permissions').insert({
        table_id: body.table_id,
        user_id: body.user_id,
        permission: body.permission,
        granted_by: user.id,
      }).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await supabase.from('audit_logs').insert({ action: 'created', entity_type: 'table_permission', entity_id: inserted.id, user_id: user.id, created_at: new Date().toISOString() })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const action = body.action || 'table'

  if (action === 'table') {
    const { error } = await supabase.from('dynamic_tables').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'deleted', entity_type: 'dynamic_table', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  if (action === 'record') {
    // Fetch record to verify permission
    const { data: rec } = await supabase.from('dynamic_table_records').select('table_id').eq('id', body.id).single()
    if (rec) {
      const { data: table } = await supabase.from('dynamic_tables').select('owner_id').eq('id', rec.table_id).single()
      if (table) {
        const isOwner = table.owner_id === user.id
        const isAdminResult = await supabase.rpc('is_admin')
        const isAdmin = isAdminResult.data ?? false
        if (!isOwner && !isAdmin) {
          const { data: perm } = await supabase
            .from('table_permissions')
            .select('permission')
            .eq('table_id', rec.table_id)
            .eq('user_id', user.id)
            .maybeSingle()
          if (!perm || perm.permission !== 'edit') {
            return NextResponse.json({ error: 'Forbidden: you do not have edit permission on this table' }, { status: 403 })
          }
        }
      }
    }
    const { error } = await supabase.from('dynamic_table_records').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'deleted', entity_type: 'dynamic_table_record', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  if (action === 'permission') {
    const { error } = await supabase.from('table_permissions').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('audit_logs').insert({ action: 'deleted', entity_type: 'table_permission', entity_id: body.id, user_id: user.id, created_at: new Date().toISOString() })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
