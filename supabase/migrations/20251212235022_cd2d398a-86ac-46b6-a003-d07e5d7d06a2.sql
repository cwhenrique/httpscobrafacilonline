-- Add column to track if user has seen the loans tutorial
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_seen_loans_tutorial BOOLEAN DEFAULT false;