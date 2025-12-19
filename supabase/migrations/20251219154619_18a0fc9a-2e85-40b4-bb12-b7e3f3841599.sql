-- Create table to track WhatsApp messages sent
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  loan_id UUID,
  contract_type TEXT NOT NULL,
  message_type TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_whatsapp_messages_loan_id ON public.whatsapp_messages(loan_id);
CREATE INDEX idx_whatsapp_messages_user_id ON public.whatsapp_messages(user_id);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own whatsapp messages"
ON public.whatsapp_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);