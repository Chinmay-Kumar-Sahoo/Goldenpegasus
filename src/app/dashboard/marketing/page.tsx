import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'All Marketing | GoldenPegasus' }

export default function AllMarketingPage() {
  return <MarketingTable isAdmin={false} readOnly={true} />
}
