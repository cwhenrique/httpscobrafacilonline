-- Add column to track if user has seen the loan form tutorial
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_seen_loan_form_tutorial BOOLEAN DEFAULT false;