-- Add joining_date column if not exists
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date date DEFAULT NULL;

-- Update handle_user_email_confirmed to include joining_date from metadata
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL AND (old.email_confirmed_at IS NULL OR old.email_confirmed_at IS DISTINCT FROM new.email_confirmed_at) THEN
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

    IF COALESCE(new.raw_user_meta_data->>'role', 'employee') = 'employee' THEN
      INSERT INTO public.employees (user_id, employee_id, full_name, email, contact, designation, joining_date, created_at, updated_at)
      VALUES (
        new.id,
        COALESCE(NULLIF(new.raw_user_meta_data->>'employee_id', ''), 'EMP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6)),
        new.raw_user_meta_data->>'full_name',
        new.email,
        NULLIF(new.raw_user_meta_data->>'contact', ''),
        NULLIF(new.raw_user_meta_data->>'designation', ''),
        NULLIF(new.raw_user_meta_data->>'joining_date', '')::date,
        now(),
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        joining_date = CASE WHEN EXCLUDED.joining_date IS NULL THEN employees.joining_date ELSE EXCLUDED.joining_date END,
        updated_at = now();
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_new_user to include joining_date from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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

    IF COALESCE(new.raw_user_meta_data->>'role', 'employee') = 'employee' THEN
      INSERT INTO public.employees (user_id, employee_id, full_name, email, contact, designation, joining_date, created_at, updated_at)
      VALUES (
        new.id,
        COALESCE(NULLIF(new.raw_user_meta_data->>'employee_id', ''), 'EMP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6)),
        new.raw_user_meta_data->>'full_name',
        new.email,
        NULLIF(new.raw_user_meta_data->>'contact', ''),
        NULLIF(new.raw_user_meta_data->>'designation', ''),
        NULLIF(new.raw_user_meta_data->>'joining_date', '')::date,
        now(),
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = now();
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
