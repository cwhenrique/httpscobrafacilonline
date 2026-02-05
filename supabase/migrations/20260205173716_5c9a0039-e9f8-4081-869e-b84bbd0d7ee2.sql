-- Add IPTV server configuration fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS iptv_server_name TEXT,
ADD COLUMN IF NOT EXISTS iptv_server_url TEXT,
ADD COLUMN IF NOT EXISTS iptv_server_cost NUMERIC DEFAULT 0;