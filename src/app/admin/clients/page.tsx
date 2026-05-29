import { createClient } from '@/lib/supabase/server'
import ClientsTable from '@/components/ClientsTable'
export const metadata = { title: 'Candidate Records | Admin | GoldenPegasus' }
export default async function AdminClientsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('Candidate_records').select('*').order('created_at', { ascending: false })
  return <ClientsTable isAdmin={true} initialRecords={data || []} />
}
