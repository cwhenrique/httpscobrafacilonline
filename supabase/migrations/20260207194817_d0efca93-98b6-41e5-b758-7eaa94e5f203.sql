-- Adicionar campo para controlar acesso ao módulo de desconto de cheque
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS check_discount_enabled boolean DEFAULT false;

-- Habilitar para o usuário específico
UPDATE public.profiles 
SET check_discount_enabled = true 
WHERE email = 'clau_pogian@hotmail.com';