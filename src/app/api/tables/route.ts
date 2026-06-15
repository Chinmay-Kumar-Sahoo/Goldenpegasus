import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tables: data || [] })
  }

  if (action === 'records' && tableId) {
    const { data, error } = await supabase
      .from('dynamic_table_records')
      .select('*')
      .eq('table_id', tableId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ records: data || [] })
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const action = body.action || 'table'

  if (action === 'update_table') {
    const { data: existing } = await supabase
      .from('dynamic_tables')
      .select('owner_id')
      .eq('id', body.id)
      .single()
    if (!existing) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    const isAdminResult = await supabase.rpc('is_admin')
    const isAdmin = isAdminResult.data ?? false
    if (existing.owner_id !== user.id && !isAdmin)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      const { data: table } = await supabase.from('dynamic_tables').select('schema_definition').eq('id', body.table_id).single()
      if (table?.schema_definition) {
        for (const field of table.schema_definition as any[]) {
          if (field.type === 'text' && body.data[field.name] && !/^[a-zA-Z\s]*$/.test(body.data[field.name])) {
            return NextResponse.json({ error: `${field.label} must only contain alphabetic characters` }, { status: 400 })
          }
        }
      }
    }
    if (body.id) {
      const { error } = await supabase
        .from('dynamic_table_records')
        .update({ data: body.data, updated_at: new Date().toISOString() })
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
