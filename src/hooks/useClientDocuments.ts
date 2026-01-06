import { useState, useEffect, useCallback } from 'react';
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [completedFiles, setCompletedFiles] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  // Estabilizar fetchDocuments com useCallback
  const fetchDocuments = useCallback(async () => {
    console.log('[Docs] fetchDocuments chamado:', {
      hasUser: !!user,
      clientId,
      employeeLoading,
    });

    if (!user || !clientId || employeeLoading) {
      console.log('[Docs] fetchDocuments retornando cedo');
      return;
    }

    setLoading(true);
    setLastFetchError(null);

    const { data, error } = await supabase.functions.invoke('list-client-documents', {
      body: { clientId },
    });

    if (error) {
      console.error('[Docs] Error fetching documents (function):', error);
      const msg = (error as any)?.message || 'Erro ao buscar documentos';
      setLastFetchError(msg);
      toast.error(`Erro ao buscar documentos: ${msg}`);
      setDocuments([]);
      setLoading(false);
      return;
    }

    const docs = (data as any)?.documents as ClientDocument[] | undefined;
    setDocuments(docs || []);
    setLoading(false);
  }, [user, clientId, employeeLoading]);

  // Estabilizar uploadDocument com useCallback
  const uploadDocument = useCallback(async (file: File, description?: string, fileIndex?: number, total?: number) => {
    console.log('[Upload] Tentativa:', { 
      hasUser: !!user, 
      clientId, 
      effectiveUserId, 
      employeeLoading,
      fileName: file.name 
    });
    
    if (!user) {
      console.error('[Upload] ERRO: Não autenticado');
      toast.error('Você precisa estar logado para enviar documentos');
      return { error: new Error('Não autenticado') };
    }
    
    if (!clientId) {
      console.error('[Upload] ERRO: Cliente não identificado');
      toast.error('Erro: Cliente não identificado');
      return { error: new Error('Cliente não identificado') };
    }
    
    if (employeeLoading) {
      console.error('[Upload] ERRO: Contexto ainda carregando');
      toast.error('Aguarde o carregamento da sessão e tente novamente');
      return { error: new Error('Sessão ainda carregando') };
    }
    
    if (!effectiveUserId) {
      console.error('[Upload] ERRO: effectiveUserId é null');
      toast.error('Erro de sessão. Recarregue a página e tente novamente.');
      return { error: new Error('effectiveUserId não disponível') };
    }

    // Verificar se o cliente existe no banco antes de fazer upload
    const { data: clientExists, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !clientExists) {
      console.error('[Upload] ERRO: Cliente não encontrado no banco:', clientId, clientError);
      toast.error('Cliente não encontrado. Salve o cliente primeiro.');
      return { error: new Error('Cliente não existe no banco de dados') };
    }

    // Não setar uploading aqui - é controlado por uploadMultipleDocuments
    setCurrentFileName(file.name);
    setUploadProgress(10);
    
    // Se recebeu info de batch, atualiza
    if (typeof fileIndex === 'number' && typeof total === 'number') {
      setTotalFiles(total);
      setCompletedFiles(fileIndex);
    }
    
    // Simular progresso durante upload
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 15, 75));
    }, 150);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${effectiveUserId}/${clientId}/${fileName}`;

    console.log('[Upload] Iniciando upload para:', filePath);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(filePath, file);

    clearInterval(progressInterval);

    if (uploadError) {
      console.error('[Upload] Storage error:', uploadError.message, uploadError);
      toast.error(`Erro no upload: ${uploadError.message}`);
      setUploadProgress(0);
      return { error: uploadError };
    }

    setUploadProgress(85);

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
      console.error('[Upload] DB error:', dbError.message, dbError);
      
      // Tentar remover arquivo órfão do storage
      console.log('[Upload] Removendo arquivo órfão do storage:', filePath);
      await supabase.storage.from('client-documents').remove([filePath]);
      
      toast.error(`Erro ao salvar documento: ${dbError.message}`);
      setUploadProgress(0);
      return { error: dbError };
    }

    setUploadProgress(100);
    console.log('[Upload] Sucesso! Documento salvo:', data);
    
    // Atualização otimista: adicionar documento diretamente ao state
    setDocuments(prev => [data as ClientDocument, ...prev]);
    
    // Pequeno delay para mostrar 100%
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return { data: data as ClientDocument };
  }, [user, clientId, effectiveUserId, employeeLoading]);
  
  // Função para upload de múltiplos arquivos com tracking
  const uploadMultipleDocuments = useCallback(async (files: File[], description?: string) => {
    console.log('[Upload] uploadMultipleDocuments iniciado, arquivos:', files.length);

    // IMPORTANTE: Setar uploading ANTES de qualquer coisa
    setUploading(true);
    setTotalFiles(files.length);
    setCompletedFiles(0);
    setUploadComplete(false);
    setCurrentFileName(files[0]?.name || '');
    setUploadProgress(5);

    let hadError = false;

    for (let i = 0; i < files.length; i++) {
      setCurrentFileName(files[i].name);
      const result = await uploadDocument(files[i], description, i, files.length);
      setCompletedFiles(i + 1);

      if (result?.error) {
        hadError = true;
        console.error('[Upload] Falha ao enviar arquivo:', files[i].name, result.error);
        toast.error('Falha ao enviar documento. Verifique sua permissão/sessão e tente novamente.');
        break;
      }
    }

    // Resetar uploading ao final
    setUploading(false);
    setUploadProgress(0);
    setUploadComplete(!hadError);
    setTotalFiles(0);
    setCompletedFiles(0);
    console.log('[Upload] uploadMultipleDocuments finalizado', { hadError });

    // Sincronizar lista com o backend após upload
    if (!hadError) {
      await fetchDocuments();
    }
  }, [uploadDocument, clientId, fetchDocuments]);

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
  }, [fetchDocuments]);

  const dismissUploadComplete = useCallback(() => {
    setUploadComplete(false);
  }, []);

  return {
    documents,
    loading,
    uploading,
    uploadProgress,
    currentFileName,
    totalFiles,
    completedFiles,
    uploadComplete,
    lastFetchError,
    uploadDocument,
    uploadMultipleDocuments,
    deleteDocument,
    getDocumentUrl,
    downloadDocument,
    fetchDocuments,
    dismissUploadComplete,
  };
}
