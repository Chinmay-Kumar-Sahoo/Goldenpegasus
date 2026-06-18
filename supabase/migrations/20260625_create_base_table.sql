CREATE TABLE IF NOT EXISTS public.base_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technology TEXT NOT NULL,
  sub_technology TEXT,
  comments TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.base_table ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "admins_select_base_table" ON public.base_table
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can insert
CREATE POLICY "admins_insert_base_table" ON public.base_table
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can update
CREATE POLICY "admins_update_base_table" ON public.base_table
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can delete
CREATE POLICY "admins_delete_base_table" ON public.base_table
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
