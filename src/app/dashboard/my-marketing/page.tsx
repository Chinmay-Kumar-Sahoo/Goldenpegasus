import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'My Marketing Records | GoldenPegasus' }

export default async function MyMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <MarketingTable isAdmin={false} readOnly={false} currentUserId={user?.id ?? null} />
}
