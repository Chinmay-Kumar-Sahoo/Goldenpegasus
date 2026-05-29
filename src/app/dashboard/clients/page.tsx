import { createClient } from '@/lib/supabase/server'
import ClientsTable from "@/components/ClientsTable";
export const metadata = { title: "My Candidates | GoldenPegasus" };
export default async function EmployeeClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('Candidate_records').select('*').eq('owner_id', user?.id ?? '').order('created_at', { ascending: false })
  return <ClientsTable isAdmin={false} initialRecords={data || []} />;
}
