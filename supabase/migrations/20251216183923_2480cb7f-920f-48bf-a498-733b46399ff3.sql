-- Add voice_assistant_enabled column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS voice_assistant_enabled BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_voice_assistant_enabled 
ON public.profiles(voice_assistant_enabled) WHERE voice_assistant_enabled = true;