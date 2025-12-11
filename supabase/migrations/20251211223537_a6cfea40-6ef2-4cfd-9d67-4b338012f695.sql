-- Create vehicles table for vehicle purchases with installment payments
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Vehicle data
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT,
  plate TEXT,
  chassis TEXT,
  -- Purchase/Sale data
  seller_name TEXT NOT NULL,
  buyer_name TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_value NUMERIC NOT NULL,
  -- Installment data
  down_payment NUMERIC DEFAULT 0,
  installments INTEGER NOT NULL DEFAULT 1,
  installment_value NUMERIC NOT NULL,
  first_due_date DATE NOT NULL,
  -- Tracking
  total_paid NUMERIC DEFAULT 0,
  remaining_balance NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own vehicles" 
ON public.vehicles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles" 
ON public.vehicles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles" 
ON public.vehicles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles" 
ON public.vehicles FOR DELETE 
USING (auth.uid() = user_id);

-- Create vehicle_payments table for tracking individual installments
CREATE TABLE public.vehicle_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own vehicle payments" 
ON public.vehicle_payments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicle payments" 
ON public.vehicle_payments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicle payments" 
ON public.vehicle_payments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicle payments" 
ON public.vehicle_payments FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicle_payments_updated_at
BEFORE UPDATE ON public.vehicle_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();