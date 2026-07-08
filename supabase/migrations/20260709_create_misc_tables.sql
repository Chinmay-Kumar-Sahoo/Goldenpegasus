-- Create misc_project_records table (no FK dependencies)
CREATE TABLE IF NOT EXISTS misc_project_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  employee_name TEXT,
  candidate_name TEXT,
  technology TEXT,
  company_name TEXT,
  project_status TEXT,
  created_date TEXT,
  project_start_date TEXT,
  project_end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create marketed_by table (no FK dependencies, standalone)
CREATE TABLE IF NOT EXISTS marketed_by (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  company TEXT,
  date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Enable RLS on both tables
ALTER TABLE misc_project_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketed_by ENABLE ROW LEVEL SECURITY;

-- RLS policies for misc_project_records
CREATE POLICY "Anyone authenticated can view misc_project_records"
  ON misc_project_records FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can insert misc_project_records"
  ON misc_project_records FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update misc_project_records"
  ON misc_project_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can delete misc_project_records"
  ON misc_project_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- RLS policies for marketed_by
CREATE POLICY "Anyone authenticated can view marketed_by"
  ON marketed_by FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can insert marketed_by"
  ON marketed_by FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can update marketed_by"
  ON marketed_by FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can delete marketed_by"
  ON marketed_by FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
