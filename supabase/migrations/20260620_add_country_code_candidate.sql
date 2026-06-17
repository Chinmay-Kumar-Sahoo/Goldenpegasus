-- Add country_code column to Candidate_records table
ALTER TABLE public."Candidate_records" ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+1';
