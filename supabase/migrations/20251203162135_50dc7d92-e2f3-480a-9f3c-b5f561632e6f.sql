-- Add avatar_url column to clients table
ALTER TABLE public.clients ADD COLUMN avatar_url text;

-- Create storage bucket for client avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('client-avatars', 'client-avatars', true);

-- Allow authenticated users to upload avatars
CREATE POLICY "Users can upload client avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-avatars' AND auth.uid() IS NOT NULL);

-- Allow public read access to avatars
CREATE POLICY "Public read access for client avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-avatars');

-- Allow users to update their avatars
CREATE POLICY "Users can update client avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'client-avatars' AND auth.uid() IS NOT NULL);

-- Allow users to delete their avatars
CREATE POLICY "Users can delete client avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-avatars' AND auth.uid() IS NOT NULL);