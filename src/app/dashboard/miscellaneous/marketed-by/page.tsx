import MiscTable from '@/components/MiscTable'

export const metadata = { title: 'Marketed By | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const FIELDS = [
  { name: 'name', label: 'Name' },
  { name: 'date', label: 'Date', type: 'date' as const },
  { name: 'notes', label: 'Notes' },
]

export default function MarketedByPage() {
  return (
    <MiscTable
      title="Marketed By"
      subtitle="Manage marketed by records"
      apiEndpoint="/api/marketed-by"
      fields={FIELDS}
      isAdmin={false}
    />
  )
}
