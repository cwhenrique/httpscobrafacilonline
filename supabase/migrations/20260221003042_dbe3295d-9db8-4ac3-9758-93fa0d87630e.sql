
-- Tabela temporária para armazenar QR codes recebidos via webhook
CREATE TABLE public.whatsapp_qr_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  qr_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 minutes')
);

-- Index para busca rápida
CREATE INDEX idx_whatsapp_qr_codes_instance ON public.whatsapp_qr_codes(instance_name);
CREATE INDEX idx_whatsapp_qr_codes_user ON public.whatsapp_qr_codes(user_id);

-- RLS
ALTER TABLE public.whatsapp_qr_codes ENABLE ROW LEVEL SECURITY;

-- Apenas service role acessa (edge functions)
CREATE POLICY "Service role only" ON public.whatsapp_qr_codes
  FOR ALL USING (false);

-- Auto-cleanup de QR codes expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_qr_codes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.whatsapp_qr_codes WHERE expires_at < now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_qr_codes_on_insert
  AFTER INSERT ON public.whatsapp_qr_codes
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_expired_qr_codes();
