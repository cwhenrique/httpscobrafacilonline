-- Add server name and URL to monthly_fees table for per-subscription configuration
ALTER TABLE monthly_fees
ADD COLUMN iptv_server_name TEXT,
ADD COLUMN iptv_server_url TEXT;