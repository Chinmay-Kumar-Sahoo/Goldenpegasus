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

const norm = (v: any) => String(v ?? '').replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u180E\u2060\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const normalizeName = (v: string | null) => v ? v.replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u180E\u2060\u2028\u2029]/g, ' ').trim().replace(/\s+/g, ' ') : v
const normalizeTech = (v: string | null) => v ? v.replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u180E\u2060\u2028\u2029]/g, ' ').trim() : v

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

  let companyNameUpdated = 0
  let nameUpdated = 0
  let techUpdated = 0
  let emailCleared = 0
  let mktDupesRemoved = 0
  let candDupesRemoved = 0
  let candNameUpdated = 0
  let candTechUpdated = 0

  // ── 1. Normalize marketing_records ─────────────────────────────────────
  const { data: mktRecs } = await adminClient
    .from('marketing_records')
    .select('id, name, technology, organization_name, implementation_partner, recruiter_email, client_email, implementation_poc_email, interviewer_email')

  if (mktRecs?.length) {
    const EMAIL_FIELDS = ['recruiter_email', 'client_email', 'implementation_poc_email', 'interviewer_email']
    for (const rec of mktRecs) {
      const updates: Record<string, any> = {}

      const newName = normalizeName(rec.name)
      if (newName !== rec.name) { updates.name = newName; nameUpdated++ }

      const newTech = normalizeTech(rec.technology)
      if (newTech !== rec.technology) { updates.technology = newTech; techUpdated++ }

      const org = normalizeCompanyName(rec.organization_name)
      if (org !== rec.organization_name) { updates.organization_name = org; companyNameUpdated++ }

      const imp = normalizeCompanyName(rec.implementation_partner)
      if (imp !== rec.implementation_partner) { updates.implementation_partner = imp; companyNameUpdated++ }

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
  }

  // ── 2. Normalize Candidate_records ─────────────────────────────────────
  const { data: candRecs } = await adminClient
    .from('Candidate_records')
    .select('id, Candidate_name, technology')

  if (candRecs?.length) {
    for (const rec of candRecs) {
      const updates: Record<string, any> = {}
      const newName = normalizeName(rec.Candidate_name)
      if (newName !== rec.Candidate_name) { updates.Candidate_name = newName; candNameUpdated++ }
      const newTech = normalizeTech(rec.technology)
      if (newTech !== rec.technology) { updates.technology = newTech; candTechUpdated++ }
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString()
        await adminClient.from('Candidate_records').update(updates).eq('id', rec.id)
      }
    }
  }

  // ── 3. Dedup marketing_records after normalization ─────────────────────
  // Use normalized (trimmed, collapsed) values for comparison.
  // Keep the earliest-created record for each unique key.
  // Must match the fields used in batch import dedup (src/app/api/marketing/batch/route.ts)
  const MKT_DEDUP_FIELDS = ['name', 'date', 'status', 'recruiter_name', 'recruiter_email', 'organization_name', 'implementation_partner', 'end_client', 'project_start_date', 'project_end_date', 'interview_date', 'interview_type', 'client_name', 'client_email', 'implementation_poc_email', 'interviewer_email', 'technology']
  const mktBuildKey = (r: any) =>
    MKT_DEDUP_FIELDS.map(f => norm(r[f])).join('|||') + '|||' + norm(r.owner_id)
  const { data: allMkt } = await adminClient
    .from('marketing_records')
    .select('id, created_at, name, date, status, recruiter_name, recruiter_email, organization_name, implementation_partner, end_client, project_start_date, project_end_date, interview_date, interview_type, client_name, client_email, implementation_poc_email, interviewer_email, technology, owner_id')
    .order('created_at', { ascending: true })
  if (allMkt?.length) {
    const seen = new Map<string, string>()
    for (const rec of allMkt) {
      const key = mktBuildKey(rec)
      if (seen.has(key)) {
        await adminClient.from('marketing_records').delete().eq('id', rec.id)
        mktDupesRemoved++
      } else {
        seen.set(key, rec.id)
      }
    }
  }

  // ── 4. Dedup Candidate_records after normalization ─────────────────────
  // Keep the earliest-created record for each (Candidate_name, technology).
  const { data: allCand } = await adminClient
    .from('Candidate_records')
    .select('id, created_at, Candidate_name, technology, owner_id')
    .order('created_at', { ascending: true })
  if (allCand?.length) {
    const seen = new Set<string>()
    for (const rec of allCand) {
      const key = norm(rec.Candidate_name) + '|' + norm(rec.technology)
      if (seen.has(key)) {
        await adminClient.from('Candidate_records').delete().eq('id', rec.id)
        candDupesRemoved++
      } else {
        seen.add(key)
      }
    }
  }

  return NextResponse.json({
    marketing: { companyNameUpdated, nameUpdated, techUpdated, emailCleared, dupesRemoved: mktDupesRemoved },
    candidates: { nameUpdated: candNameUpdated, techUpdated: candTechUpdated, dupesRemoved: candDupesRemoved },
  })
}
