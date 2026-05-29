import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing | Admin | GoldenPegasus' }

export default async function AdminMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <MarketingTable isAdmin={true} readOnly={false} currentUserId={user?.id ?? null} />
}
