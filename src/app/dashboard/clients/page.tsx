import { createClient } from '@/lib/supabase/server'
import ClientsTable from "@/components/ClientsTable";
export const metadata = { title: "My Candidates | GoldenPegasus" };
export default async function EmployeeClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  const { data: rawRecords } = await supabase
    .from('Candidate_records')
    .select('*')
    .or(`owner_id.eq.${uid},backup_employee_id.eq.${uid}`)
    .order('created_at', { ascending: false })

  const records = (rawRecords || []).map(r => ({ ...r, employee_name: null, backup_employee_name: null }))

  return <ClientsTable isAdmin={false} initialRecords={records} initialOwnerNames={{}} currentUserId={uid} />;
}
