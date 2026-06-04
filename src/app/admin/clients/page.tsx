import { createClient } from '@/lib/supabase/server'
import ClientsTable from '@/components/ClientsTable'
export const metadata = { title: 'Candidate Records | Admin | GoldenPegasus' }
export default async function AdminClientsPage() {
  const supabase = await createClient()

  const [recordsResult, employeeProfiles, employeesFromTable] = await Promise.all([
    supabase.from('Candidate_records').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email').neq('role', 'admin').not('role', 'is', null),
    supabase.from('employees').select('user_id, full_name, email'),
  ])

  const records = recordsResult.data

  const employeeMap = new Map(((employeesFromTable?.data || []) as any[]).map((e: any) => [e.user_id, e]))
  const employeeOptions = (employeeProfiles.data || []).map((p: any) => {
    const emp = employeeMap.get(p.id)
    return { id: p.id, full_name: emp?.full_name || p.full_name || p.email || 'Unknown' }
  })
  const profileIds = new Set((employeeProfiles.data || []).map((p: any) => p.id))
  for (const e of ((employeesFromTable?.data || []) as any[])) {
    if (e.user_id && !profileIds.has(e.user_id)) {
      employeeOptions.push({ id: e.user_id, full_name: e.full_name || e.email || 'Unknown' })
    }
  }

  return <ClientsTable isAdmin={true} initialRecords={records || []} employeeOptions={employeeOptions} />
}
