-- Add owner_type column to bills table for personal/business separation
ALTER TABLE public.bills 
ADD COLUMN owner_type text DEFAULT 'personal' CHECK (owner_type IN ('personal', 'business'));