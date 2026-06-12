import { createClient } from '@/lib/supabase/server'
import ProfileContent from './profile-content'

export const metadata = { title: 'Personal Details | GoldenPegasus' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <ProfileContent />

  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
    supabase.from('employees').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const initialProfile = profile ? {
    full_name: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    email: profile.email || user.email || '',
  } : undefined

  const initialEmployee = employee ? {
    employee_id: employee.employee_id || '',
    contact: employee.contact || '',
    address: employee.address || '',
    date_of_birth: employee.date_of_birth || '',
    joining_date: employee.joining_date || '',
    company_id: employee.company_id || '',
    designation: employee.designation || '',
  } : undefined

  return <ProfileContent initialProfile={initialProfile} initialEmployee={initialEmployee} userId={user.id} />
}
