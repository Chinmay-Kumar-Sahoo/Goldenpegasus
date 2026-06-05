import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/format'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim() || ''
  const type = searchParams.get('type') || 'all'
  const status = searchParams.get('status') || 'all'

  const supabase = await createClient()
  const results: Array<{
    id: string
    type: 'marketing' | 'employee' | 'client' | 'admin'
    title: string
    subtitle: string
    meta: string
    status?: string | null
  }> = []

  // Helper to check if employee should be included based on status filter
  const includeEmployee = status === 'all' || status === 'active';

  // If no query, return empty results
  if (query.length === 0) {
    return NextResponse.json({ 
      results: [], 
      count: 0,
      message: ""
    })
  }

  // Marketing Records search
  if (type === 'all' || type === 'marketing_records') {
    let mktQuery = supabase
      .from('marketing_records')
      .select('id, name, organization_name, end_client, status, date')
      .or(`name.ilike.%${query}%,organization_name.ilike.%${query}%,end_client.ilike.%${query}%,status.ilike.%${query}%,date.ilike.%${query}%`)
    
    if (status !== 'all') mktQuery = mktQuery.eq('status', status)
    
    const { data: mktData } = await mktQuery.limit(8)
    
    if (mktData) {
      results.push(...mktData.map(r => ({
        id: r.id,
        type: 'marketing' as const,
        title: r.name,
        subtitle: [r.organization_name, r.end_client].filter(Boolean).join(' → ') || 'Marketing Record',
        meta: r.date ? formatDate(r.date) : 'No date',
        status: r.status
      })))
    }
  }

  // Employees search
  if ((type === 'all' || type === 'employees') && includeEmployee) {
    const { data: empData } = await supabase
      .from('employees')
      .select('id, full_name, email, designation, employee_id')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,designation.ilike.%${query}%,employee_id.ilike.%${query}%`)
      .limit(8)
      
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(8)
      
    const allEmps = [...(empData || []), ...(profData || [])];
    const uniqueEmps = Array.from(new Map(allEmps.map(item => [item.email, item])).values());
    
    if (uniqueEmps.length > 0) {
      results.push(...uniqueEmps.slice(0, 8).map((e: any) => ({
        id: e.id,
        type: (e.role === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee',
        title: e.full_name,
        subtitle: e.designation || (e.role === 'admin' ? 'Admin' : 'Employee'),
        meta: e.employee_id || e.email,
        status: 'active'
      })))
    }
  }

  // Client Records search
  if (type === 'all' || type === 'client_records') {
    let clientQuery = supabase
      .from('client_records')
      .select('id, client_name, client_email, company_name, status')
      .or(`client_name.ilike.%${query}%,client_email.ilike.%${query}%,company_name.ilike.%${query}%,status.ilike.%${query}%`)
    
    if (status !== 'all') clientQuery = clientQuery.eq('status', status)
    
    const { data: clientData } = await clientQuery.limit(8)
    
    if (clientData) {
      results.push(...clientData.map(c => ({
        id: c.id,
        type: 'client' as const,
        title: c.client_name,
        subtitle: c.company_name || 'Client',
        meta: c.client_email,
        status: c.status
      })))
    }
  }

  return NextResponse.json({ 
    results, 
    count: results.length,
    message: results.length > 0 ? "Login to see detailed records." : "No results found."
  })
}
