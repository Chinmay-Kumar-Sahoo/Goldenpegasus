import ClientsTable from '@/components/ClientsTable'
export const metadata = { title: 'Client Records | Admin | GoldenPegasus' }
export default function AdminClientsPage() {
  return <ClientsTable isAdmin={true} />
}
