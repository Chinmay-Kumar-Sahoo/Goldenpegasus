import MiscTable from '@/components/MiscTable'

export const metadata = { title: 'Project Records | GoldenPegasus' }
export const dynamic = 'force-dynamic'

const FIELDS = [
  { name: 'employee_name', label: 'Employee Name' },
  { name: 'candidate_name', label: 'Candidate Name' },
  { name: 'technology', label: 'Technology' },
  { name: 'company_name', label: 'Company Name' },
  { name: 'project_status', label: 'Project Status' },
  { name: 'created_date', label: 'Created Date' },
  { name: 'project_start_date', label: 'Project Start Date' },
  { name: 'project_end_date', label: 'Project End Date' },
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
