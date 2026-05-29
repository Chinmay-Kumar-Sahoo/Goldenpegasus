import { createClient } from '@/lib/supabase/server'
import DynamicTables from '@/components/DynamicTables'
export const metadata = { title: 'Dynamic Tables | Admin | GoldenPegasus' }
export default async function AdminTablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('dynamic_tables').select('*').order('created_at', { ascending: false })
  return <DynamicTables isAdmin={true} initialTables={data || []} initialUserId={user?.id ?? null} />
}
