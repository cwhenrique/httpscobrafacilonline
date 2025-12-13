-- Add contract_date column to loans table
ALTER TABLE public.loans ADD COLUMN contract_date date;

-- Update existing records to use start_date as contract_date
UPDATE public.loans SET contract_date = start_date WHERE contract_date IS NULL;