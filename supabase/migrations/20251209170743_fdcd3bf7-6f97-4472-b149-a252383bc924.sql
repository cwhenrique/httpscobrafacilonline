-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for client documents bucket
CREATE POLICY "Users can upload their own client documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own client documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own client documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create table for tracking client documents
CREATE TABLE public.client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own client documents"
ON public.client_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client documents"
ON public.client_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own client documents"
ON public.client_documents FOR DELETE
USING (auth.uid() = user_id);