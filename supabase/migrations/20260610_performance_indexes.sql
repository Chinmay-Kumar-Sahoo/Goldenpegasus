-- Performance indexes for 10-15 concurrent users
-- Table names are quoted to preserve case (created via Supabase dash)

-- Candidate_records query patterns (owner + backup filtering, name-based JOIN)
CREATE INDEX IF NOT EXISTS idx_candidate_records_owner_id ON "Candidate_records"(owner_id);
CREATE INDEX IF NOT EXISTS idx_candidate_records_backup_employee_id ON "Candidate_records"(backup_employee_id);
CREATE INDEX IF NOT EXISTS idx_candidate_records_name ON "Candidate_records"("Candidate_name");

-- Marketing records query patterns (owner filtering, name-based JOIN, status filter)
CREATE INDEX IF NOT EXISTS idx_marketing_records_name ON marketing_records(name);
CREATE INDEX IF NOT EXISTS idx_marketing_records_status ON marketing_records(status);
CREATE INDEX IF NOT EXISTS idx_marketing_records_owner_id_name ON marketing_records(owner_id, name);

-- Covered index for employee name lookups
CREATE INDEX IF NOT EXISTS idx_employees_user_id_covering ON employees(user_id) INCLUDE (full_name, email);

-- Covered index for profile role filtering (admin/employee checks)
CREATE INDEX IF NOT EXISTS idx_profiles_role_id_covering ON profiles(role, id) INCLUDE (full_name, email);

-- Analyzer update for query planner
ANALYZE "Candidate_records";
ANALYZE marketing_records;
ANALYZE profiles;
ANALYZE employees;
