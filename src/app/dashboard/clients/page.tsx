import ClientsTable from "@/components/ClientsTable";
export const metadata = { title: "My Candidates | GoldenPegasus" };
export default function EmployeeClientsPage() {
  return <ClientsTable isAdmin={false} />;
}
