-- Add contact fields to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS buyer_phone text,
ADD COLUMN IF NOT EXISTS buyer_email text;