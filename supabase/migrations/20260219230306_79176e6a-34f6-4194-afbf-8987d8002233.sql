ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS auto_report_frequency text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS auto_report_categories text[] DEFAULT '{loans}';