-- Add bill_type to contracts table to distinguish between payable and receivable
ALTER TABLE public.contracts ADD COLUMN bill_type text NOT NULL DEFAULT 'receivable';

-- Add more contract types for rental properties
COMMENT ON COLUMN public.contracts.contract_type IS 'Type: aluguel_casa, aluguel_kitnet, mensalidade, parcelado, avista';
COMMENT ON COLUMN public.contracts.bill_type IS 'Type: payable (a pagar) or receivable (a receber)';