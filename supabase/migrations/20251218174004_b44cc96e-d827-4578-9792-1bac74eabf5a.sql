-- Adicionar coluna category na tabela bills para categorização de contas
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'outros';

-- Adicionar coluna is_recurring para contas recorrentes
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;