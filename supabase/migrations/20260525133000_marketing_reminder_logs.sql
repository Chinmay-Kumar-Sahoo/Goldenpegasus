CREATE TABLE IF NOT EXISTS public.marketing_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_record_id uuid NOT NULL REFERENCES public.marketing_records(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_reminder_logs_record_sent_idx
  ON public.marketing_reminder_logs (marketing_record_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS marketing_reminder_logs_owner_sent_idx
  ON public.marketing_reminder_logs (owner_id, sent_at DESC);

ALTER TABLE public.marketing_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view marketing reminder logs" ON public.marketing_reminder_logs;
CREATE POLICY "Admins can view marketing reminder logs"
  ON public.marketing_reminder_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

