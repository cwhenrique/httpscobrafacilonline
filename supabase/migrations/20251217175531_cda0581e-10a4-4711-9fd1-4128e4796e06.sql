-- Add social media columns to clients table
ALTER TABLE public.clients 
ADD COLUMN instagram text,
ADD COLUMN facebook text;