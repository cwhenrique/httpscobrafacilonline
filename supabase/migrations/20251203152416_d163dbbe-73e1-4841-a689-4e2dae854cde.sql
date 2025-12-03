
-- Enum for client types
CREATE TYPE public.client_type AS ENUM ('loan', 'monthly', 'both');

-- Enum for payment status
CREATE TYPE public.payment_status AS ENUM ('paid', 'pending', 'overdue');

-- Enum for interest type
CREATE TYPE public.interest_type AS ENUM ('simple', 'compound');

-- Enum for loan payment type
CREATE TYPE public.loan_payment_type AS ENUM ('single', 'installment');

-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  client_type client_type NOT NULL DEFAULT 'loan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loans table
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  interest_type interest_type NOT NULL DEFAULT 'simple',
  payment_type loan_payment_type NOT NULL DEFAULT 'single',
  installments INTEGER DEFAULT 1,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  total_interest DECIMAL(15,2) DEFAULT 0,
  total_paid DECIMAL(15,2) DEFAULT 0,
  remaining_balance DECIMAL(15,2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loan payments table
CREATE TABLE public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  principal_paid DECIMAL(15,2) DEFAULT 0,
  interest_paid DECIMAL(15,2) DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly fees (mensalidades) table
CREATE TABLE public.monthly_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  due_day INTEGER NOT NULL DEFAULT 5 CHECK (due_day >= 1 AND due_day <= 28),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly fee payments table
CREATE TABLE public.monthly_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_fee_id UUID NOT NULL REFERENCES public.monthly_fees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_date DATE,
  due_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_fee_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for clients
CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for loans
CREATE POLICY "Users can view own loans" ON public.loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loans" ON public.loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loans" ON public.loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loans" ON public.loans FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for loan_payments
CREATE POLICY "Users can view own loan payments" ON public.loan_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own loan payments" ON public.loan_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own loan payments" ON public.loan_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own loan payments" ON public.loan_payments FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for monthly_fees
CREATE POLICY "Users can view own monthly fees" ON public.monthly_fees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly fees" ON public.monthly_fees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly fees" ON public.monthly_fees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly fees" ON public.monthly_fees FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for monthly_fee_payments
CREATE POLICY "Users can view own monthly fee payments" ON public.monthly_fee_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly fee payments" ON public.monthly_fee_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly fee payments" ON public.monthly_fee_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly fee payments" ON public.monthly_fee_payments FOR DELETE USING (auth.uid() = user_id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_fees_updated_at BEFORE UPDATE ON public.monthly_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_fee_payments_updated_at BEFORE UPDATE ON public.monthly_fee_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate and update loan balance after payment
CREATE OR REPLACE FUNCTION public.update_loan_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.loans
  SET 
    total_paid = total_paid + NEW.amount,
    remaining_balance = remaining_balance - NEW.principal_paid,
    status = CASE 
      WHEN remaining_balance - NEW.principal_paid <= 0 THEN 'paid'::payment_status
      WHEN due_date < CURRENT_DATE THEN 'overdue'::payment_status
      ELSE 'pending'::payment_status
    END
  WHERE id = NEW.loan_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_loan_payment_insert
  AFTER INSERT ON public.loan_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_loan_on_payment();

-- Indexes for better performance
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_client_id ON public.loans(client_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_loan_payments_loan_id ON public.loan_payments(loan_id);
CREATE INDEX idx_monthly_fees_user_id ON public.monthly_fees(user_id);
CREATE INDEX idx_monthly_fees_client_id ON public.monthly_fees(client_id);
CREATE INDEX idx_monthly_fee_payments_monthly_fee_id ON public.monthly_fee_payments(monthly_fee_id);
CREATE INDEX idx_monthly_fee_payments_status ON public.monthly_fee_payments(status);
