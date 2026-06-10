-- Recreate admin_profiles table (previous migration may have failed silently)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  is_root boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'active', 'disabled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_profiles_status_idx
  ON public.admin_profiles (status);

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin profiles" ON public.admin_profiles;
CREATE POLICY "Admins can view admin profiles"
  ON public.admin_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.sync_admin_profile_from_profile()
RETURNS trigger AS $$
BEGIN
  IF new.role = 'admin' THEN
    INSERT INTO public.admin_profiles (
      user_id,
      email,
      full_name,
      is_root,
      status,
      email_confirmed_at,
      updated_at
    )
    VALUES (
      new.id,
      COALESCE(new.email, ''),
      COALESCE(new.full_name, 'Administrator'),
      lower(COALESCE(new.email, '')) = 'admin@goldenpegasusit.com',
      CASE WHEN new.email_confirmed_at IS NULL THEN 'pending_verification' ELSE 'active' END,
      new.email_confirmed_at,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      is_root = admin_profiles.is_root OR EXCLUDED.is_root,
      status = CASE
        WHEN admin_profiles.status = 'disabled' THEN 'disabled'
        WHEN EXCLUDED.email_confirmed_at IS NULL THEN 'pending_verification'
        ELSE 'active'
      END,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      updated_at = now();
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_admin_profile_synced ON public.profiles;
CREATE TRIGGER on_admin_profile_synced
AFTER INSERT OR UPDATE OF email, full_name, role, email_confirmed_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_admin_profile_from_profile();
