-- Revert trigger to original: only clean up employees and profiles.
-- Remaining cleanup (Candidate_records, marketing_records, etc.)
-- is handled by the API handlers before calling deleteUser.

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS trigger AS $$
BEGIN
  -- Delete from employees and profiles
  DELETE FROM public.employees WHERE user_id = old.id;
  DELETE FROM public.profiles WHERE id = old.id;

  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
