-- Add cost_value column to product_sales table for profit calculation
ALTER TABLE public.product_sales ADD COLUMN cost_value numeric DEFAULT 0;

-- Add comment explaining the fields
COMMENT ON COLUMN public.product_sales.cost_value IS 'Custo de aquisição do produto (quanto pagou)';
COMMENT ON COLUMN public.product_sales.total_amount IS 'Valor de venda do produto (quanto está vendendo)';