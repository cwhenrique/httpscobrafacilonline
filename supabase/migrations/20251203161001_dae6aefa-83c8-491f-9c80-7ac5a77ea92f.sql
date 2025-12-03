-- Add column to store installment due dates as JSON array
ALTER TABLE public.loans ADD COLUMN installment_dates jsonb DEFAULT '[]'::jsonb;