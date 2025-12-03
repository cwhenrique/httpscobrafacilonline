-- Create contracts table for rental/installment contracts
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'parcelado',
  total_amount NUMERIC NOT NULL,
  amount_to_receive NUMERIC NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  installments INTEGER NOT NULL DEFAULT 1,
  first_payment_date DATE NOT NULL,
  payment_method TEXT DEFAULT 'all_days',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contract_payments table for tracking individual installment payments
CREATE TABLE public.contract_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for contracts
CREATE POLICY "Users can view own contracts" ON public.contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contracts" ON public.contracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contracts" ON public.contracts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contracts" ON public.contracts FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for contract_payments
CREATE POLICY "Users can view own contract payments" ON public.contract_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contract payments" ON public.contract_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contract payments" ON public.contract_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contract payments" ON public.contract_payments FOR DELETE USING (auth.uid() = user_id);

-- Update trigger for contracts
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for contract_payments
CREATE TRIGGER update_contract_payments_updated_at
  BEFORE UPDATE ON public.contract_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();