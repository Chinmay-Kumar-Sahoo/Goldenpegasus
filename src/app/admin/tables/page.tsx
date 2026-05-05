import DynamicTables from '@/components/DynamicTables'
export const metadata = { title: 'Dynamic Tables | Admin | GoldenPegasus' }
export default function AdminTablesPage() {
  return <DynamicTables isAdmin={true} />
}
