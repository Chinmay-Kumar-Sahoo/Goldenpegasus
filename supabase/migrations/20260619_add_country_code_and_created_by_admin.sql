-- Add country_code column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+1';

-- Add created_by_admin column to employees table to track admin-created users
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT FALSE;
