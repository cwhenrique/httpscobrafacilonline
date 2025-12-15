-- Add WhatsApp client notification configuration fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS evolution_api_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS evolution_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS evolution_instance_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_to_clients_enabled boolean DEFAULT false;