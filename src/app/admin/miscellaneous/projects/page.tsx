import MiscTable from '@/components/MiscTable'

export const metadata = { title: 'Project Records | Admin | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const FIELDS = [
  { name: 'content', label: 'Content', type: 'textarea' as const },
]

export default function AdminMiscProjectsPage() {
  return (
    <MiscTable
      title="Project Records"
      subtitle="Manage project records (Admin)"
      apiEndpoint="/api/misc-projects"
      fields={FIELDS}
      isAdmin={true}
    />
  )
}
