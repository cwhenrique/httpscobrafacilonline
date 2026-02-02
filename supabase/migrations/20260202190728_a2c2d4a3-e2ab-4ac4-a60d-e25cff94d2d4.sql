-- Add billing message configuration column to profiles
ALTER TABLE public.profiles
ADD COLUMN billing_message_config JSONB DEFAULT '{
  "includeClientName": true,
  "includeInstallmentNumber": true,
  "includeAmount": true,
  "includeDueDate": true,
  "includeDaysOverdue": true,
  "includePenalty": true,
  "includeProgressBar": true,
  "includeInstallmentsList": false,
  "includePaymentOptions": true,
  "includePixKey": true,
  "includeSignature": true,
  "customClosingMessage": ""
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.billing_message_config IS 'User preferences for which fields to include in WhatsApp billing messages';