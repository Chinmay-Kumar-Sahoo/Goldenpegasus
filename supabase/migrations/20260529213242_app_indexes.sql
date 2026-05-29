CREATE INDEX IF NOT EXISTS idx_marketing_records_owner_id ON public.marketing_records(owner_id);
CREATE INDEX IF NOT EXISTS idx_marketing_records_created_at ON public.marketing_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_records_name ON public.marketing_records(name);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_reminder_logs_record_id ON public.marketing_reminder_logs(marketing_record_id);
