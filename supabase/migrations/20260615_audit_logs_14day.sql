-- Change audit log retention from 7 days to 14 days
-- Replaces the trigger function created by 20260603_audit_logs_cleanup.sql

CREATE OR REPLACE FUNCTION public.trigger_cleanup_old_audit_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '14 days';
  RETURN new;
END;
$$;
