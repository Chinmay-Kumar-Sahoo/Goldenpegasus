import MiscTable from '@/components/MiscTable'

export const metadata = { title: 'Project Records | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const FIELDS = [
  { name: 'content', label: 'Content', type: 'textarea' as const },
]

export default function MiscProjectsPage() {
  return (
    <MiscTable
      title="Project Records"
      subtitle="Manage project records"
      apiEndpoint="/api/misc-projects"
      fields={FIELDS}
      isAdmin={false}
    />
  )
}
