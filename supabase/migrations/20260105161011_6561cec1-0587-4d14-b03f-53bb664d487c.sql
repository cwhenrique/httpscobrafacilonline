-- Create pending_messages table for opt-in confirmation system
CREATE TABLE public.pending_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_phone TEXT NOT NULL,
  client_name TEXT NOT NULL,
  
  -- Message type and related contract
  message_type TEXT NOT NULL, -- 'loan_receipt', 'payment_receipt', 'overdue', 'due_today', 'early'
  contract_id UUID,
  contract_type TEXT, -- 'loan', 'product', 'vehicle', 'contract'
  
  -- Full message content to send after confirmation
  message_content TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'expired', 'cancelled'
  confirmation_keyword TEXT DEFAULT 'OK',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  confirmed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX idx_pending_messages_phone_status ON public.pending_messages(client_phone, status);
CREATE INDEX idx_pending_messages_user_id ON public.pending_messages(user_id);
CREATE INDEX idx_pending_messages_expires ON public.pending_messages(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own pending messages"
  ON public.pending_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pending messages"
  ON public.pending_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending messages"
  ON public.pending_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending messages"
  ON public.pending_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Employee policies
CREATE POLICY "Employees can view owner pending messages"
  ON public.pending_messages
  FOR SELECT
  USING (user_id = get_employee_owner_id(auth.uid()));

CREATE POLICY "Employees can insert pending messages for owner"
  ON public.pending_messages
  FOR INSERT
  WITH CHECK (user_id = get_employee_owner_id(auth.uid()));

CREATE POLICY "Employees can update owner pending messages"
  ON public.pending_messages
  FOR UPDATE
  USING (user_id = get_employee_owner_id(auth.uid()));