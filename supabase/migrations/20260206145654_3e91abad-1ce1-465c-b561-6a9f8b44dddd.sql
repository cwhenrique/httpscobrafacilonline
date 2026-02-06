-- Add column for scheduled report hours
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS report_schedule_hours integer[] DEFAULT '{}';