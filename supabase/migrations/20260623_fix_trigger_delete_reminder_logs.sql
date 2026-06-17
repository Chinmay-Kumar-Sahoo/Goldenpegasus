-- Fix trigger: marketing_reminder_logs.owner_id is NOT NULL, must DELETE not UPDATE

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger AS $$
BEGIN
  -- Nullify owner references in Candidate_records
  UPDATE public."Candidate_records" SET owner_id = NULL WHERE owner_id = old.id;
  UPDATE public."Candidate_records" SET backup_employee_id = NULL WHERE backup_employee_id = old.id;

  -- Nullify owner references in marketing_records
  UPDATE public.marketing_records SET owner_id = NULL WHERE owner_id = old.id;

  -- Delete reminder logs for this owner (owner_id is NOT NULL)
  DELETE FROM public.marketing_reminder_logs WHERE owner_id = old.id;

  -- Delete from employees and profiles last
  DELETE FROM public.employees WHERE user_id = old.id;
  DELETE FROM public.profiles WHERE id = old.id;

  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
