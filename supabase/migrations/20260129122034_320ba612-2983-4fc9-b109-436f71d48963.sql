-- Add affiliate_email column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS affiliate_email text;