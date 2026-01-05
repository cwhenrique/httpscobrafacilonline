-- Adicionar políticas de storage para funcionários no bucket client-documents

-- Funcionários podem ver documentos do dono
CREATE POLICY "Employees can view owner client documents storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-documents' 
  AND (storage.foldername(name))[1] = (get_employee_owner_id(auth.uid()))::text
);

-- Funcionários podem fazer upload de documentos para o dono
CREATE POLICY "Employees can upload owner client documents storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents' 
  AND (storage.foldername(name))[1] = (get_employee_owner_id(auth.uid()))::text
);

-- Funcionários podem deletar documentos do dono
CREATE POLICY "Employees can delete owner client documents storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-documents' 
  AND (storage.foldername(name))[1] = (get_employee_owner_id(auth.uid()))::text
);

-- Adicionar política UPDATE para tabela client_documents (donos)
CREATE POLICY "Users can update own client documents"
ON public.client_documents FOR UPDATE
USING (auth.uid() = user_id);

-- Adicionar política UPDATE para tabela client_documents (funcionários)
CREATE POLICY "Employees can update owner client documents"
ON public.client_documents FOR UPDATE
USING (user_id = get_employee_owner_id(auth.uid()));