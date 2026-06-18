-- Replace flat base_table with two-table design: technology + sub_technologies
DROP TABLE IF EXISTS public.base_table CASCADE;

-- Technologies
CREATE TABLE public.base_technologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  comments TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sub-technologies (each belongs to one technology)
CREATE TABLE public.base_sub_technologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technology_id UUID NOT NULL REFERENCES public.base_technologies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  comments TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.base_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_sub_technologies ENABLE ROW LEVEL SECURITY;

-- Technology policies (admin only)
CREATE POLICY "admins_select_base_technologies" ON public.base_technologies
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admins_insert_base_technologies" ON public.base_technologies
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admins_update_base_technologies" ON public.base_technologies
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admins_delete_base_technologies" ON public.base_technologies
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sub-technology policies (admin only)
CREATE POLICY "admins_select_base_sub_technologies" ON public.base_sub_technologies
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admins_insert_base_sub_technologies" ON public.base_sub_technologies
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admins_update_base_sub_technologies" ON public.base_sub_technologies
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admins_delete_base_sub_technologies" ON public.base_sub_technologies
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
