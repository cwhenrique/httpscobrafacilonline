-- Add profession and referrer fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profession text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referrer_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referrer_phone text;

COMMENT ON COLUMN clients.profession IS 'Profissão/ocupação do cliente';
COMMENT ON COLUMN clients.referrer_name IS 'Nome de quem indicou o cliente';
COMMENT ON COLUMN clients.referrer_phone IS 'Telefone de quem indicou o cliente';