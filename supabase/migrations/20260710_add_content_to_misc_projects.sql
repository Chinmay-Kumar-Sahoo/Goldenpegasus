-- Add content column for free-text input
ALTER TABLE misc_project_records ADD COLUMN IF NOT EXISTS content TEXT;

-- Backfill existing structured data into content field
UPDATE misc_project_records
SET content = TRIM(CHR(10) FROM CONCAT_WS(CHR(10),
  CASE WHEN NULLIF(employee_name, '') IS NOT NULL THEN CONCAT('Employee Name: ', employee_name) END,
  CASE WHEN NULLIF(candidate_name, '') IS NOT NULL THEN CONCAT('Candidate Name: ', candidate_name) END,
  CASE WHEN NULLIF(technology, '') IS NOT NULL THEN CONCAT('Technology: ', technology) END,
  CASE WHEN NULLIF(company_name, '') IS NOT NULL THEN CONCAT('Company Name: ', company_name) END,
  CASE WHEN NULLIF(project_status, '') IS NOT NULL THEN CONCAT('Project Status: ', project_status) END,
  CASE WHEN NULLIF(created_date, '') IS NOT NULL THEN CONCAT('Created Date: ', created_date) END,
  CASE WHEN NULLIF(project_start_date, '') IS NOT NULL THEN CONCAT('Project Start Date: ', project_start_date) END,
  CASE WHEN NULLIF(project_end_date, '') IS NOT NULL THEN CONCAT('Project End Date: ', project_end_date) END
))
WHERE content IS NULL;
