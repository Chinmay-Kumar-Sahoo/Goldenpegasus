import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing | Admin | GoldenPegasus' }

export default function AdminMarketingPage() {
  return <MarketingTable isAdmin={true} readOnly={false} />
}
