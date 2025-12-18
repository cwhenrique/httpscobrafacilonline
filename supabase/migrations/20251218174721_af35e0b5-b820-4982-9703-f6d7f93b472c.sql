-- Add recurrence_months column to bills table
-- NULL means infinite recurrence, a number means X months of recurrence
ALTER TABLE public.bills ADD COLUMN recurrence_months INTEGER DEFAULT NULL;