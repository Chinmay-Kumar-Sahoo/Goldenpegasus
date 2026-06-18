import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Forbidden', status: 403 }
  return { user }
}

// GET: fetch all technologies with nested sub-technologies
export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await checkAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data: techs, error: techErr } = await supabase
      .from('base_technologies')
      .select('*')
      .order('name', { ascending: true })

    if (techErr) return NextResponse.json({ error: techErr.message }, { status: 500 })

    const { data: subs, error: subErr } = await supabase
      .from('base_sub_technologies')
      .select('*')
      .order('name', { ascending: true })

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })

    const subMap: Record<string, any[]> = {}
    for (const s of subs || []) {
      if (!subMap[s.technology_id]) subMap[s.technology_id] = []
      subMap[s.technology_id].push(s)
    }

    const technologies = (techs || []).map(t => ({
      ...t,
      sub_technologies: subMap[t.id] || [],
    }))

    return NextResponse.json({ technologies })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// POST: create/update technology or sub-technology
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await checkAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const { kind } = body

    if (kind === 'technology') {
      if (body.id) {
        const updates: Record<string, any> = { updated_at: new Date().toISOString() }
        if (body.name !== undefined) updates.name = body.name
        if (body.comments !== undefined) updates.comments = body.comments || null
        const { error } = await supabase.from('base_technologies').update(updates).eq('id', body.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }
      if (!body.name?.trim()) return NextResponse.json({ error: 'Technology name is required' }, { status: 400 })
      const { data, error } = await supabase.from('base_technologies').insert({
        name: body.name.trim(),
        comments: body.comments?.trim() || null,
        owner_id: auth.user.id,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ technology: data }, { status: 201 })
    }

    if (kind === 'sub') {
      if (body.id) {
        const updates: Record<string, any> = { updated_at: new Date().toISOString() }
        if (body.name !== undefined) updates.name = body.name
        if (body.comments !== undefined) updates.comments = body.comments || null
        const { error } = await supabase.from('base_sub_technologies').update(updates).eq('id', body.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }
      if (!body.technology_id) return NextResponse.json({ error: 'technology_id is required' }, { status: 400 })
      if (!body.name?.trim()) return NextResponse.json({ error: 'Sub-technology name is required' }, { status: 400 })
      const { data, error } = await supabase.from('base_sub_technologies').insert({
        technology_id: body.technology_id,
        name: body.name.trim(),
        comments: body.comments?.trim() || null,
        owner_id: auth.user.id,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ sub_technology: data }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid kind. Use "technology" or "sub".' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE: delete technology(s) or sub-technology(s)
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await checkAdmin(supabase)
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const { kind } = body

    if (kind === 'technology') {
      const ids = body.ids || (body.id ? [body.id] : [])
      if (!ids.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 })
      // CASCADE deletes sub-technologies automatically
      const { error } = await supabase.from('base_technologies').delete().in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: ids.length })
    }

    if (kind === 'sub') {
      const ids = body.ids || (body.id ? [body.id] : [])
      if (!ids.length) return NextResponse.json({ error: 'id(s) required' }, { status: 400 })
      const { error } = await supabase.from('base_sub_technologies').delete().in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: ids.length })
    }

    return NextResponse.json({ error: 'Invalid kind. Use "technology" or "sub".' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
