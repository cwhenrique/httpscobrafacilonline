-- Add pix_key column to bills table
ALTER TABLE public.bills ADD COLUMN pix_key TEXT DEFAULT NULL;