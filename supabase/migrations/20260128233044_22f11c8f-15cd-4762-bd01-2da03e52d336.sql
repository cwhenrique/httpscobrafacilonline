-- Add pix_pre_message column to profiles table
ALTER TABLE profiles 
ADD COLUMN pix_pre_message text;

COMMENT ON COLUMN profiles.pix_pre_message IS 
'Mensagem personalizada exibida junto com a chave PIX nas cobranças';