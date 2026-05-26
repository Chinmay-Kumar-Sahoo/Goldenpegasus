# Marketing Reminder Function

Runs a daily shift-start email reminder for `active` and `pending` marketing records.

Default behavior:
- Checks `marketing_records.status in ('active', 'pending')`.
- Resolves the maintainer from `owner_id` using `profiles` and `employees`.
- Sends the reminder to the maintainer's registered email.
- Logs sends in `marketing_reminder_logs`.
- Sends at most once every 3 days per marketing record.

Required Supabase secrets:

Local/no-provider test mode:

```bash
npm run supabase -- secrets set EMAIL_PROVIDER=log
npm run supabase -- secrets set APP_URL="http://localhost:3000"
npm run supabase -- secrets set REMINDER_CRON_SECRET="create-a-long-random-secret"
npm run supabase -- secrets set MIN_DAYS_BETWEEN_REMINDERS=3
```

In `log` mode, the function does not send real email. It prints the email target/subject in function logs and still writes a dry-run row to `marketing_reminder_logs`.

Resend mode:

```bash
npm run supabase -- secrets set EMAIL_PROVIDER=resend
npm run supabase -- secrets set RESEND_API_KEY=...
npm run supabase -- secrets set REMINDER_FROM_EMAIL="Golden Pegasus <noreply@yourdomain.com>"
npm run supabase -- secrets set REMINDER_CRON_SECRET="create-a-long-random-secret"
npm run supabase -- secrets set APP_URL="https://your-app-domain.com"
npm run supabase -- secrets set MIN_DAYS_BETWEEN_REMINDERS=3
```

Generic webhook mode:

```bash
npm run supabase -- secrets set EMAIL_PROVIDER=webhook
npm run supabase -- secrets set EMAIL_WEBHOOK_URL="https://your-email-service.example/send"
npm run supabase -- secrets set EMAIL_WEBHOOK_AUTH_HEADER="Authorization: Bearer your-token"
npm run supabase -- secrets set REMINDER_FROM_EMAIL="Golden Pegasus <noreply@yourdomain.com>"
npm run supabase -- secrets set REMINDER_CRON_SECRET="create-a-long-random-secret"
npm run supabase -- secrets set APP_URL="https://your-app-domain.com"
npm run supabase -- secrets set MIN_DAYS_BETWEEN_REMINDERS=3
```

The webhook receives:

```json
{
  "from": "Golden Pegasus <noreply@yourdomain.com>",
  "to": "employee@example.com",
  "subject": "Follow-up reminder: Candidate is pending",
  "html": "<div>...</div>",
  "text": "Plain text version",
  "metadata": {
    "marketing_record_id": "...",
    "owner_id": "...",
    "status": "pending"
  }
}
```

Deploy:

```bash
npm run reminders:deploy
```

Schedule:
- Run `supabase/marketing-reminder-cron.sql` in Supabase SQL Editor.
- The cron expression is `30 13 * * *`, which is 7:00 PM IST daily.
- The cron file stores `project_url` and `marketing_reminder_cron_secret` in Supabase Vault so secrets are not embedded directly in the scheduled job.
