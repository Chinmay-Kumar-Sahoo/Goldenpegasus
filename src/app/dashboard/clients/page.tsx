import ClientsTable from '@/components/ClientsTable'
export const metadata = { title: 'My Clients | GoldenPegasus' }
export default function EmployeeClientsPage() {
  return <ClientsTable isAdmin={false} />
}
