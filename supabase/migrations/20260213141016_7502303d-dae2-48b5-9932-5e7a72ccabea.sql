
-- Table to track WhatsApp message delivery/read status
CREATE TABLE public.whatsapp_message_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_message_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own message statuses"
ON public.whatsapp_message_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert statuses"
ON public.whatsapp_message_status FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_whatsapp_message_status_message_id ON public.whatsapp_message_status(message_id);
CREATE INDEX idx_whatsapp_message_status_phone ON public.whatsapp_message_status(phone);
CREATE INDEX idx_whatsapp_message_status_user_id ON public.whatsapp_message_status(user_id);
