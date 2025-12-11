-- Create table for product sales
CREATE TABLE public.product_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL,
  down_payment NUMERIC DEFAULT 0,
  installments INTEGER NOT NULL DEFAULT 1,
  installment_value NUMERIC NOT NULL,
  first_due_date DATE NOT NULL,
  remaining_balance NUMERIC NOT NULL,
  total_paid NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for product sale payments
CREATE TABLE public.product_sale_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_sale_id UUID NOT NULL REFERENCES public.product_sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sale_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_sales
CREATE POLICY "Users can view own product sales"
ON public.product_sales FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product sales"
ON public.product_sales FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product sales"
ON public.product_sales FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own product sales"
ON public.product_sales FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for product_sale_payments
CREATE POLICY "Users can view own product sale payments"
ON public.product_sale_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product sale payments"
ON public.product_sale_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product sale payments"
ON public.product_sale_payments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own product sale payments"
ON public.product_sale_payments FOR DELETE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_product_sales_updated_at
BEFORE UPDATE ON public.product_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_sale_payments_updated_at
BEFORE UPDATE ON public.product_sale_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();