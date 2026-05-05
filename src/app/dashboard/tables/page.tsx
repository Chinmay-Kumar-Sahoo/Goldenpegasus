import DynamicTables from '@/components/DynamicTables'
export const metadata = { title: 'Custom Tables | GoldenPegasus' }
export default function EmployeeTablesPage() {
  return <DynamicTables isAdmin={false} />
}
