-- Add purchase origin fields to check_discounts table
ALTER TABLE public.check_discounts
ADD COLUMN purchase_value numeric DEFAULT NULL,
ADD COLUMN seller_name text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.check_discounts.purchase_value IS 'Valor que o cliente pagou para adquirir o cheque';
COMMENT ON COLUMN public.check_discounts.seller_name IS 'Nome de quem vendeu o cheque ao cliente';