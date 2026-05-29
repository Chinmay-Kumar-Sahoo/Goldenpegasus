import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing | GoldenPegasus' }

export default async function AllMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <MarketingTable isAdmin={false} readOnly={true} currentUserId={user?.id ?? null} />
}
