import MiscTable from '@/components/MiscTable'

export const metadata = { title: 'Marketed By | Admin | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const FIELDS = [
  { name: 'name', label: 'Name' },
  { name: 'company', label: 'Company' },
  { name: 'date', label: 'Date' },
  { name: 'notes', label: 'Notes' },
]

export default function AdminMarketedByPage() {
  return (
    <MiscTable
      title="Marketed By"
      subtitle="Manage marketed by records (Admin)"
      apiEndpoint="/api/marketed-by"
      fields={FIELDS}
      isAdmin={true}
    />
  )
}
