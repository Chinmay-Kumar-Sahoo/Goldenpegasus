import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing | Admin | GoldenPegasus' }

export default async function AdminMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: records } = await supabase
    .from('marketing_records')
    .select('*')
    .order('created_at', { ascending: false })

  if (!records) {
    return <MarketingTable isAdmin={true} readOnly={false} currentUserId={user?.id ?? null} />
  }

  const ownerIds = Array.from(new Set(records.map(r => r.owner_id).filter(Boolean)))
  let ownerNames: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const [{ data: profiles }, { data: employees }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', ownerIds),
      supabase.from('employees').select('user_id, full_name, email').in('user_id', ownerIds),
    ])
    ownerNames = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || p.email || 'Unknown employee']))
    for (const e of (employees || [])) {
      if (e.user_id) ownerNames[e.user_id] = e.full_name || e.email || ownerNames[e.user_id] || 'Unknown employee'
    }
  }

  return (
    <MarketingTable
      isAdmin={true}
      readOnly={false}
      currentUserId={user?.id ?? null}
      initialRecords={records}
      initialOwnerNames={ownerNames}
    />
  )
}
