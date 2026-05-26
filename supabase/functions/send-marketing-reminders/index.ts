import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4'

type MarketingRecord = {
  id: string
  owner_id: string
  name: string
  status: string | null
  recruiter_name: string | null
  organization_name: string | null
  end_client: string | null
  interview_date: string | null
  notes: string | null
}

type Person = {
  full_name: string | null
  email: string | null
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EMAIL_PROVIDER = (Deno.env.get('EMAIL_PROVIDER') || 'log').toLowerCase()
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_WEBHOOK_URL = Deno.env.get('EMAIL_WEBHOOK_URL')
const EMAIL_WEBHOOK_AUTH_HEADER = Deno.env.get('EMAIL_WEBHOOK_AUTH_HEADER')
const REMINDER_FROM_EMAIL = Deno.env.get('REMINDER_FROM_EMAIL') || 'Golden Pegasus <onboarding@resend.dev>'
const REMINDER_CRON_SECRET = Deno.env.get('REMINDER_CRON_SECRET')
const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000'
const MIN_DAYS_BETWEEN_REMINDERS = Number(Deno.env.get('MIN_DAYS_BETWEEN_REMINDERS') || '3')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const daysAgoIso = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

const getDisplayName = (person?: Person | null) => person?.full_name || person?.email || 'there'

const escapeHtml = (value: string | null | undefined) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildReminderEmail = (record: MarketingRecord, recipient: Person) => {
  const employeeName = escapeHtml(getDisplayName(recipient))
  const dashboardUrl = APP_URL ? `${APP_URL.replace(/\/$/, '')}/dashboard/marketing` : ''
  const status = escapeHtml(record.status || 'pending')

  return {
    from: REMINDER_FROM_EMAIL,
    to: recipient.email!,
    subject: `Follow-up reminder: ${record.name} is ${record.status || 'pending'}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
        <p>Hi ${employeeName},</p>
        <p>This is a shift-start reminder for a marketing record that is still <strong>${status}</strong>.</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td style="padding:4px 0"><strong>${escapeHtml(record.name)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Status</td><td style="padding:4px 0">${status}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Recruiter</td><td style="padding:4px 0">${escapeHtml(record.recruiter_name) || '-'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Organization</td><td style="padding:4px 0">${escapeHtml(record.organization_name) || '-'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">End client</td><td style="padding:4px 0">${escapeHtml(record.end_client) || '-'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Interview date</td><td style="padding:4px 0">${escapeHtml(record.interview_date) || '-'}</td></tr>
        </table>
        <p>Please follow up and update the record when there is progress.</p>
        ${dashboardUrl ? `<p><a href="${dashboardUrl}" style="color:#16a34a">Open All Marketing</a></p>` : ''}
      </div>
    `,
    text: [
      `Hi ${getDisplayName(recipient)},`,
      '',
      `This is a shift-start reminder for a marketing record that is still ${record.status || 'pending'}.`,
      '',
      `Name: ${record.name}`,
      `Status: ${record.status || 'pending'}`,
      `Recruiter: ${record.recruiter_name || '-'}`,
      `Organization: ${record.organization_name || '-'}`,
      `End Client: ${record.end_client || '-'}`,
      `Interview Date: ${record.interview_date || '-'}`,
      dashboardUrl ? `Open All Marketing: ${dashboardUrl}` : '',
    ].filter(Boolean).join('\n'),
  }
}

const sendReminderEmail = async (record: MarketingRecord, recipient: Person) => {
  const email = buildReminderEmail(record, recipient)

  if (EMAIL_PROVIDER === 'log' || EMAIL_PROVIDER === 'none') {
    console.log('Marketing reminder email dry run', {
      to: email.to,
      subject: email.subject,
      recordId: record.id,
      ownerId: record.owner_id,
    })
    return `dry-run-${record.id}-${Date.now()}`
  }

  if (EMAIL_PROVIDER === 'webhook') {
    if (!EMAIL_WEBHOOK_URL) {
      throw new Error('EMAIL_WEBHOOK_URL is not configured')
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (EMAIL_WEBHOOK_AUTH_HEADER) {
      const [name, ...valueParts] = EMAIL_WEBHOOK_AUTH_HEADER.split(':')
      if (name && valueParts.length > 0) headers[name.trim()] = valueParts.join(':').trim()
    }

    const response = await fetch(EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...email,
        metadata: {
          marketing_record_id: record.id,
          owner_id: record.owner_id,
          status: record.status,
        },
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result?.message || `Email webhook returned ${response.status}`)
    }

    return result?.id || result?.message_id || `webhook-${record.id}-${Date.now()}`
  }

  if (EMAIL_PROVIDER !== 'resend') {
    throw new Error(`Unsupported EMAIL_PROVIDER "${EMAIL_PROVIDER}". Use log, resend, or webhook.`)
  }

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result?.message || `Email provider returned ${response.status}`)
  }

  return result?.id as string | undefined
}

serve(async (req) => {
  if (REMINDER_CRON_SECRET && req.headers.get('x-reminder-secret') !== REMINDER_CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const since = daysAgoIso(MIN_DAYS_BETWEEN_REMINDERS)

  const { data: records, error: recordsError } = await supabase
    .from('marketing_records')
    .select('id, owner_id, name, status, recruiter_name, organization_name, end_client, interview_date, notes')
    .or('status.ilike.active,status.ilike.pending')
    .order('created_at', { ascending: true })

  if (recordsError) return json({ error: recordsError.message }, 500)

  const candidates = (records || []) as MarketingRecord[]
  if (candidates.length === 0) return json({ checked: 0, sent: 0, skipped: 0 })

  const recordIds = candidates.map((record) => record.id)
  const ownerIds = Array.from(new Set(candidates.map((record) => record.owner_id)))

  const [{ data: recentLogs }, { data: profiles }, { data: employees }] = await Promise.all([
    supabase
      .from('marketing_reminder_logs')
      .select('marketing_record_id')
      .in('marketing_record_id', recordIds)
      .is('error', null)
      .gte('sent_at', since),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ownerIds),
    supabase
      .from('employees')
      .select('user_id, full_name, email')
      .in('user_id', ownerIds),
  ])

  const recentlyReminded = new Set((recentLogs || []).map((log) => log.marketing_record_id))
  const recipients = new Map<string, Person>()

  for (const profile of profiles || []) {
    recipients.set(profile.id, { full_name: profile.full_name, email: profile.email })
  }

  for (const employee of employees || []) {
    if (employee.user_id) {
      recipients.set(employee.user_id, {
        full_name: employee.full_name || recipients.get(employee.user_id)?.full_name || null,
        email: employee.email || recipients.get(employee.user_id)?.email || null,
      })
    }
  }

  let sent = 0
  let skipped = 0
  const errors: Array<{ recordId: string; message: string }> = []

  for (const record of candidates) {
    if (recentlyReminded.has(record.id)) {
      skipped += 1
      continue
    }

    const recipient = recipients.get(record.owner_id)
    if (!recipient?.email) {
      skipped += 1
      errors.push({ recordId: record.id, message: 'No recipient email found' })
      continue
    }

    try {
      const providerMessageId = await sendReminderEmail(record, recipient)
      await supabase.from('marketing_reminder_logs').insert({
        marketing_record_id: record.id,
        owner_id: record.owner_id,
        recipient_email: recipient.email,
        status: record.status || 'pending',
        provider_message_id: providerMessageId || null,
      })
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push({ recordId: record.id, message })
      await supabase.from('marketing_reminder_logs').insert({
        marketing_record_id: record.id,
        owner_id: record.owner_id,
        recipient_email: recipient.email,
        status: record.status || 'pending',
        error: message,
      })
    }
  }

  return json({ checked: candidates.length, sent, skipped, errors })
})
