-- Add contract_date column to contracts table
ALTER TABLE public.contracts ADD COLUMN contract_date date;

-- Set default value for existing contracts to their created_at date
UPDATE public.contracts SET contract_date = created_at::date WHERE contract_date IS NULL;