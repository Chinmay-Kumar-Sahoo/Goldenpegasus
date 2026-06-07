-- Fix FK on audit_logs: change from auth.users to profiles
-- PostgREST requires FK to public.profiles for nested selects like profiles(full_name)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
