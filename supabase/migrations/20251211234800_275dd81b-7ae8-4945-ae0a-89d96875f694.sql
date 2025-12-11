-- Add client detail fields to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS client_phone text,
ADD COLUMN IF NOT EXISTS client_cpf text,
ADD COLUMN IF NOT EXISTS client_rg text,
ADD COLUMN IF NOT EXISTS client_email text,
ADD COLUMN IF NOT EXISTS client_address text;

-- Add missing client detail fields to product_sales table
ALTER TABLE public.product_sales
ADD COLUMN IF NOT EXISTS client_cpf text,
ADD COLUMN IF NOT EXISTS client_rg text,
ADD COLUMN IF NOT EXISTS client_address text;

-- Add missing client detail fields to vehicles table
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS buyer_cpf text,
ADD COLUMN IF NOT EXISTS buyer_rg text,
ADD COLUMN IF NOT EXISTS buyer_address text;