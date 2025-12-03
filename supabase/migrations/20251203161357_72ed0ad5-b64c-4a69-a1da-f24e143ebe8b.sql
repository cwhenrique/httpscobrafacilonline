-- Add enum for interest mode
CREATE TYPE public.interest_mode AS ENUM ('per_installment', 'on_total');

-- Add column for interest calculation mode
ALTER TABLE public.loans ADD COLUMN interest_mode public.interest_mode DEFAULT 'on_total';