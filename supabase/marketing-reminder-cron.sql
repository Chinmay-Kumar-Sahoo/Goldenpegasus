-- Run this after deploying the send-marketing-reminders Edge Function.
-- Schedule: every day at 7:00 PM IST = 1:30 PM UTC.
-- Requires Supabase extensions: pg_cron, pg_net, and vault.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Store production values securely in Supabase Vault.
-- Replace the placeholders once, then run this SQL in the Supabase SQL Editor.
SELECT vault.create_secret('https://uhjcnfglspbcgtlwyckh.supabase.co', 'project_url');
SELECT vault.create_secret('<REMINDER_CRON_SECRET>', 'marketing_reminder_cron_secret');

SELECT cron.unschedule('daily-marketing-followup-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-marketing-followup-reminders'
);

SELECT cron.schedule(
  'daily-marketing-followup-reminders',
  '30 13 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-marketing-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'marketing_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
