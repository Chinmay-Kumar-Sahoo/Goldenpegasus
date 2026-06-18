import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Read-only: returns all technologies (with sub-technologies) for use in dropdowns, reference, etc.
// Authenticated users (admin + employee) can read this.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: techs } = await supabase
      .from('base_technologies')
      .select('id, name, comments')
      .order('name', { ascending: true })

    const { data: subs } = await supabase
      .from('base_sub_technologies')
      .select('id, technology_id, name, comments')
      .order('name', { ascending: true })

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
