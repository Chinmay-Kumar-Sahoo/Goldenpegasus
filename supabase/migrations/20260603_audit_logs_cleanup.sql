-- Auto-delete audit logs older than 7 days
-- Uses a trigger on INSERT to clean up stale records

CREATE OR REPLACE FUNCTION public.trigger_cleanup_old_audit_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '7 days';
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_old_audit_logs_trigger ON public.audit_logs;
CREATE TRIGGER cleanup_old_audit_logs_trigger
AFTER INSERT ON public.audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_cleanup_old_audit_logs();
