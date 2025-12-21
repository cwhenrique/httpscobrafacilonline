-- Add is_active column to clients table
ALTER TABLE public.clients ADD COLUMN is_active boolean NOT NULL DEFAULT true;