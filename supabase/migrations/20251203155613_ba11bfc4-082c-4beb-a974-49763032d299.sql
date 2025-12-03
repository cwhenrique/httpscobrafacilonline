-- Add interest_rate column to monthly_fees table
ALTER TABLE public.monthly_fees 
ADD COLUMN interest_rate numeric DEFAULT 0;