-- Add 'weekly' to the loan_payment_type enum
ALTER TYPE public.loan_payment_type ADD VALUE IF NOT EXISTS 'weekly';