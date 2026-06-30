import { createClient } from '@/lib/supabase/server'
import DynamicTables from '@/components/DynamicTables'
export const metadata = { title: 'Custom Tables | GoldenPegasus' }
export default async function EmployeeTablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('dynamic_tables').select('*').neq('table_name', 'My Project Records').order('created_at', { ascending: false })
  return <DynamicTables isAdmin={false} initialTables={data || []} initialUserId={user?.id ?? null} />
}
