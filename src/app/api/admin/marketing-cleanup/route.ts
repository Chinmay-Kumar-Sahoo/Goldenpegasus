import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const isValidEmail = (v: string | null) => !v || /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v)

const COMPANY_VARIATIONS: Record<string, string> = {
  'techm': 'Tech Mahindra',
  'tech mahindra': 'Tech Mahindra',
  'tech mahindra limited': 'Tech Mahindra',
  'mahindra': 'Tech Mahindra',
  'infosys': 'Infosys',
  'infy': 'Infosys',
  'tcs': 'TCS',
  'tata consultancy services': 'TCS',
  'tata consultancy': 'TCS',
  'wipro': 'Wipro',
  'wipro limited': 'Wipro',
  'wipro technologies': 'Wipro',
  'hcl': 'HCL',
  'hcl technologies': 'HCL',
  'hcl tech': 'HCL',
  'accenture': 'Accenture',
  'accenture technology': 'Accenture',
  'accenture technologies': 'Accenture',
  'cognizant': 'Cognizant',
  'cognizant technology solutions': 'Cognizant',
  'cts': 'Cognizant',
  'ibm': 'IBM',
  'i.b.m.': 'IBM',
  'capgemini': 'Capgemini',
  'capg': 'Capgemini',
  'lti': 'LTI',
  'l&t infotech': 'LTI',
  'larsen & toubro infotech': 'LTI',
  'mindtree': 'Mindtree',
  'ltimindtree': 'LTI Mindtree',
  'dell': 'Dell',
  'dell technologies': 'Dell',
  'deloitte': 'Deloitte',
  'deloitte consulting': 'Deloitte',
  'epam': 'EPAM',
  'epam systems': 'EPAM',
  'mphasis': 'Mphasis',
  'hexaware': 'Hexaware',
  'hexaware technologies': 'Hexaware',
  'persistent': 'Persistent',
  'persistent systems': 'Persistent',
  'synechron': 'Synechron',
  'teksystems': 'TekSystems',
  'tek systems': 'TekSystems',
  'randstad': 'Randstad',
  'randstad technologies': 'Randstad',
}

const normalizeCompanyName = (value: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  const key = trimmed.toLowerCase()
  return COMPANY_VARIATIONS[key] || trimmed
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: records } = await adminClient
    .from('marketing_records')
    .select('id, organization_name, implementation_partner, recruiter_email, client_email, implementation_poc_email, interviewer_email')

  if (!records?.length) return NextResponse.json({ updated: 0, emailCleared: 0 })

  let nameUpdated = 0
  let emailCleared = 0
  const EMAIL_FIELDS = ['recruiter_email', 'client_email', 'implementation_poc_email', 'interviewer_email']

  for (const rec of records) {
    const updates: Record<string, any> = {}
    const org = normalizeCompanyName(rec.organization_name)
    if (org !== rec.organization_name) {
      updates.organization_name = org
      nameUpdated++
    }
    const imp = normalizeCompanyName(rec.implementation_partner)
    if (imp !== rec.implementation_partner) {
      updates.implementation_partner = imp
      nameUpdated++
    }
    for (const field of EMAIL_FIELDS) {
      const val = (rec as any)[field]
      if (val && !isValidEmail(val)) {
        updates[field] = null
        emailCleared++
      }
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await adminClient.from('marketing_records').update(updates).eq('id', rec.id)
    }
  }

  // --- Remove duplicate records (same values across key user-facing fields + same owner_id) ---
  // Excluding date fields and notes as those commonly vary between otherwise identical records
  const dedupFields = ['name','technology','recruiter_email','organization_name','implementation_partner','end_client','client_name','client_email','implementation_poc_email','interviewer_email']
  const buildKey = (r: any) => dedupFields.map(f => ((r[f] ?? '') + '').toLowerCase().trim()).join('|||') + '|||' + (r.owner_id || '')
  let removedDupes = 0
  const { data: allRecords } = await adminClient
    .from('marketing_records')
    .select('id, created_at, name, technology, recruiter_email, organization_name, implementation_partner, end_client, client_name, client_email, implementation_poc_email, interviewer_email, owner_id')
    .order('created_at', { ascending: true })
  if (allRecords?.length) {
    const seen = new Map<string, string>()
    for (const rec of allRecords) {
      const key = buildKey(rec)
      if (seen.has(key)) {
        await adminClient.from('marketing_records').delete().eq('id', rec.id)
        removedDupes++
      } else {
        seen.set(key, rec.id)
      }
    }
  }

  return NextResponse.json({ updated: nameUpdated, emailCleared, removedDupes })
}
