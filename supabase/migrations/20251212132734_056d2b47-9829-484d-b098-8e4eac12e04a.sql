-- Add cost_value column to vehicles table for profit calculation
ALTER TABLE public.vehicles ADD COLUMN cost_value numeric DEFAULT 0;

-- Add comment explaining the fields
COMMENT ON COLUMN public.vehicles.cost_value IS 'Custo de aquisição do veículo (quanto pagou)';
COMMENT ON COLUMN public.vehicles.purchase_value IS 'Valor de venda do veículo (quanto está vendendo)';