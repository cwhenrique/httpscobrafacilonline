-- Add temp_password column to store initial password for trial users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS temp_password text;