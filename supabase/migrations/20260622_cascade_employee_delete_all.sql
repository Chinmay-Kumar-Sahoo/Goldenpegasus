-- Extend cascade delete: when a user is deleted, also clean up references
-- in Candidate_records, marketing_records, and marketing_reminder_logs

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger AS $$
BEGIN
  -- Nullify owner references in Candidate_records
  UPDATE public."Candidate_records" SET owner_id = NULL WHERE owner_id = old.id;
  UPDATE public."Candidate_records" SET backup_employee_id = NULL WHERE backup_employee_id = old.id;

  -- Nullify owner references in marketing_records
  UPDATE public.marketing_records SET owner_id = NULL WHERE owner_id = old.id;

  -- Nullify owner references in marketing_reminder_logs
  UPDATE public.marketing_reminder_logs SET owner_id = NULL WHERE owner_id = old.id;

  -- Delete from employees and profiles last
  DELETE FROM public.employees WHERE user_id = old.id;
  DELETE FROM public.profiles WHERE id = old.id;

  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
