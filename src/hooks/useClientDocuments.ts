import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { toast } from 'sonner';

export interface ClientDocument {
  id: string;
  user_id: string;
  client_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  description: string | null;
  created_at: string;
}

export function useClientDocuments(clientId: string | null) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  const fetchDocuments = async () => {
    if (!user || !clientId || employeeLoading) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
    } else {
      setDocuments(data as ClientDocument[]);
    }
    setLoading(false);
  };

  const uploadDocument = async (file: File, description?: string) => {
    if (!user || !clientId || !effectiveUserId) return { error: new Error('Não autenticado') };

    setUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${effectiveUserId}/${clientId}/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Erro ao fazer upload do documento');
      setUploading(false);
      return { error: uploadError };
    }

    // Save document record
    const { data, error: dbError } = await supabase
      .from('client_documents')
      .insert({
        user_id: effectiveUserId,
        client_id: clientId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        description: description || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      toast.error('Erro ao salvar documento');
      setUploading(false);
      return { error: dbError };
    }

    toast.success('Documento enviado com sucesso!');
    await fetchDocuments();
    setUploading(false);
    return { data: data as ClientDocument };
  };

  const deleteDocument = async (documentId: string, filePath: string) => {
    if (!user) return { error: new Error('Não autenticado') };

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('client-documents')
      .remove([filePath]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('client_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      toast.error('Erro ao excluir documento');
      return { error: dbError };
    }

    toast.success('Documento excluído com sucesso!');
    await fetchDocuments();
    return { success: true };
  };

  const getDocumentUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting document URL:', error);
      toast.error('Erro ao gerar link de download');
      return null;
    }

    return data?.signedUrl;
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('client-documents')
      .download(filePath);

    if (error) {
      console.error('Error downloading document:', error);
      toast.error('Erro ao baixar documento');
      return false;
    }

    // Criar blob URL e iniciar download
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  };

  useEffect(() => {
    fetchDocuments();
  }, [user, clientId, effectiveUserId, employeeLoading]);

  return {
    documents,
    loading,
    uploading,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
    downloadDocument,
    fetchDocuments,
  };
}
