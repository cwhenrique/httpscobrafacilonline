-- Create bills (contas a pagar) table
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  payee_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending'::payment_status,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own bills"
ON public.bills
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bills"
ON public.bills
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bills"
ON public.bills
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bills"
ON public.bills
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_bills_updated_at
BEFORE UPDATE ON public.bills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();