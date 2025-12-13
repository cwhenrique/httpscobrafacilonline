-- Add CPF, RG, and email fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS rg text,
ADD COLUMN IF NOT EXISTS email text;