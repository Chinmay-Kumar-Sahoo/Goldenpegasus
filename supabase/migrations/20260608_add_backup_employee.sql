-- Add backup_employee_id column to Candidate_records
ALTER TABLE public."Candidate_records" ADD COLUMN IF NOT EXISTS backup_employee_id text;

-- Add backup_employee_name column to Candidate_records for display
ALTER TABLE public."Candidate_records" ADD COLUMN IF NOT EXISTS backup_employee_name text;
