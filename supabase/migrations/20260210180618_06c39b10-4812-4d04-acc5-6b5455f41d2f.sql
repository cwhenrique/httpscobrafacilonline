
-- Adicionar colunas de configuração de envio automático de cobranças para clientes
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auto_client_reports_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_report_hour integer NOT NULL DEFAULT 8,
ADD COLUMN IF NOT EXISTS auto_report_types text[] NOT NULL DEFAULT ARRAY['due_today','overdue'];
