-- Add columns for WhatsApp instance management via QR Code
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_instance_id text,
ADD COLUMN IF NOT EXISTS whatsapp_connected_phone text,
ADD COLUMN IF NOT EXISTS whatsapp_connected_at timestamp with time zone;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_instance_id ON public.profiles(whatsapp_instance_id);