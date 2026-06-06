ALTER TABLE public."Candidate_records" ADD COLUMN IF NOT EXISTS technology TEXT;
ALTER TABLE public.marketing_records ADD COLUMN IF NOT EXISTS technology TEXT;
