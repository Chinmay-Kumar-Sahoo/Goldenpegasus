import MarketingTable from '@/components/MarketingTable'

export const metadata = { title: 'My Marketing Records | GoldenPegasus' }

export default function MyMarketingPage() {
  return <MarketingTable isAdmin={false} readOnly={false} />
}
