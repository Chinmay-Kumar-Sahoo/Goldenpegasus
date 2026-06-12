-- Add missing RLS policies for client-side profile/employee saves
-- Without these, authenticated users cannot update their own profiles or employee records

-- Enable RLS on profiles (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to UPDATE their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow users to INSERT their own profile (needed for first-time setup)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Allow users to UPDATE their own employee record
DROP POLICY IF EXISTS "Users can update own employee record" ON public.employees;
CREATE POLICY "Users can update own employee record"
  ON public.employees
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow users to INSERT their own employee record
DROP POLICY IF EXISTS "Users can insert own employee record" ON public.employees;
CREATE POLICY "Users can insert own employee record"
  ON public.employees
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow admins to UPDATE their own admin_profiles record (trigger also handles this)
DROP POLICY IF EXISTS "Admins can update own admin profile" ON public.admin_profiles;
CREATE POLICY "Admins can update own admin profile"
  ON public.admin_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
