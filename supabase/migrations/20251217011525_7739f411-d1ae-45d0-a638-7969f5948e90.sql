-- Add 'biweekly' to the loan_payment_type enum
ALTER TYPE public.loan_payment_type ADD VALUE IF NOT EXISTS 'biweekly';