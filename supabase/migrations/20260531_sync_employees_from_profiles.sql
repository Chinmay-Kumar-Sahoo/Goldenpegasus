-- Sync employees table from profiles when role = 'employee'
-- This ensures every employee profile automatically creates an employees record

CREATE OR REPLACE FUNCTION public.sync_employee_from_profile()
RETURNS trigger AS $$
BEGIN
  IF new.role = 'employee' THEN
    INSERT INTO public.employees (user_id, employee_id, full_name, email, created_at, updated_at)
    VALUES (new.id, 'EMP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6), new.full_name, new.email, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      updated_at = now();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sync_employee_from_profile ON public.profiles;
CREATE TRIGGER on_sync_employee_from_profile
AFTER INSERT OR UPDATE OF full_name, email ON public.profiles
FOR EACH ROW
WHEN (new.role = 'employee')
EXECUTE FUNCTION public.sync_employee_from_profile();

-- Backfill: create employees records for existing employee profiles that don't have one
INSERT INTO public.employees (user_id, employee_id, full_name, email, created_at, updated_at)
SELECT p.id, 'EMP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6), p.full_name, p.email, now(), now()
FROM public.profiles p
LEFT JOIN public.employees e ON e.user_id = p.id
LEFT JOIN public.employees e2 ON e2.email = p.email
WHERE p.role = 'employee' AND e.id IS NULL AND e2.id IS NULL
ON CONFLICT (user_id) DO NOTHING;
