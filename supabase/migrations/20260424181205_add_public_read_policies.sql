
-- Allow public SELECT on employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view limited employee details" ON public.employees FOR SELECT USING (true);

-- Allow public SELECT on marketing_records
ALTER TABLE public.marketing_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view limited marketing details" ON public.marketing_records FOR SELECT USING (true);

-- Allow public SELECT on client_records
ALTER TABLE public.client_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view limited client details" ON public.client_records FOR SELECT USING (true);
