-- Revert trigger to original scope: only delete employees and profiles.
-- Additional cleanup (Candidate_records, marketing_records) is handled
-- by the API handlers with per-query error handling.

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.employees WHERE user_id = old.id;
  DELETE FROM public.profiles WHERE id = old.id;
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
