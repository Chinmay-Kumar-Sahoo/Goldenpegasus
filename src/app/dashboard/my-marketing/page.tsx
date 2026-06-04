import { createClient } from '@/lib/supabase/server'
import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'My Marketing Records | GoldenPegasus' }

export default async function MyMarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [recordsResult, candidatesResult] = await Promise.all([
    supabase.from('marketing_records').select('*').eq('owner_id', user?.id ?? '').order('created_at', { ascending: false }),
    supabase.from('Candidate_records').select('id, Candidate_name, owner_id').eq('owner_id', user?.id ?? ''),
  ])

  const records = recordsResult.data

  if (!records) {
    return <MarketingTable isAdmin={false} readOnly={false} currentUserId={user?.id ?? null} />
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

  const candidateOptions = (candidatesResult.data || []).map((c: any) => ({
    id: c.id,
    name: c.Candidate_name,
    owner_id: c.owner_id,
  }))

  return (
    <MarketingTable
      isAdmin={false}
      readOnly={false}
      currentUserId={user?.id ?? null}
      initialRecords={records}
      initialOwnerNames={ownerNames}
      candidateOptions={candidateOptions}
    />
  )
}
