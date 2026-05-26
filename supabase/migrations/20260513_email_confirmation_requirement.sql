-- This migration ensures that user profiles are only created after email confirmation

-- Add email_confirmed column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_confirmed_at timestamp with time zone DEFAULT NULL;

-- Create or replace the trigger function to only create profiles for confirmed emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Only create profile if email is confirmed at the time of user creation
  -- (This happens for manually created users or if email confirmation is disabled)
  IF new.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, email, role, email_confirmed_at, created_at, updated_at)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.email,
      COALESCE(new.raw_user_meta_data->>'role', 'employee'),
      new.email_confirmed_at,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_confirmed_at = new.email_confirmed_at,
      updated_at = now();
  END IF;
  -- If email_confirmed_at is NULL, we DO NOT create a profile here.
  -- It will be created by the update trigger when they confirm.

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create a function to handle email confirmation updates
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger AS $$
BEGIN
  -- Check if email was just confirmed
  IF new.email_confirmed_at IS NOT NULL AND (old.email_confirmed_at IS NULL OR old.email_confirmed_at IS DISTINCT FROM new.email_confirmed_at) THEN
    -- UPSERT the profile to ensure it exists and is marked as confirmed
    INSERT INTO public.profiles (id, full_name, email, role, email_confirmed_at, created_at, updated_at)
    VALUES (
      new.id,
      new.raw_user_meta_data->>'full_name',
      new.email,
      COALESCE(new.raw_user_meta_data->>'role', 'employee'),
      new.email_confirmed_at,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_confirmed_at = new.email_confirmed_at,
      updated_at = now();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email confirmation updates
DROP TRIGGER IF EXISTS on_user_email_confirmed ON auth.users;
CREATE TRIGGER on_user_email_confirmed
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_email_confirmed();

