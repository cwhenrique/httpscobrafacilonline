-- Add billing_signature_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN billing_signature_name text;