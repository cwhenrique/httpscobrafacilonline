import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, ClientType } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { toast } from 'sonner';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  const fetchClients = async () => {
    if (!user || employeeLoading || !effectiveUserId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('full_name');

    if (error) {
      toast.error('Erro ao carregar clientes');
      console.error(error);
    } else {
      setClients(data as Client[]);
    }
    setLoading(false);
  };

  const createClient = async (client: {
    full_name: string;
    phone?: string;
    address?: string;
    notes?: string;
    client_type: ClientType;
    cpf?: string;
    rg?: string;
    email?: string;
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    avatar_url?: string;
    instagram?: string;
    facebook?: string;
  }) => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...client,
        user_id: effectiveUserId,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar cliente');
      return { error };
    }

    toast.success('Cliente criado com sucesso!');
    await fetchClients();
    return { data: data as Client };
  };

  const uploadAvatar = async (clientId: string, file: File) => {
    console.log('Avatar upload attempt:', { user: !!user, effectiveUserId, clientId, employeeLoading });
    
    if (!user) {
      toast.error('Você precisa estar logado para enviar fotos');
      return { error: new Error('Usuário não autenticado') };
    }
    
    if (employeeLoading || !effectiveUserId) {
      toast.error('Aguarde o carregamento da sessão e tente novamente');
      return { error: new Error('Sessão ainda carregando') };
    }

    try {
      const fileExt = file.name.split('.').pop();
      // Use simpler path: clientId.ext (consistent with other uploads)
      const filePath = `${clientId}.${fileExt}`;

      console.log('[Avatar] Uploading to path:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('client-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('[Avatar] Storage upload error:', uploadError);
        toast.error('Erro ao enviar foto: ' + uploadError.message);
        return { error: uploadError };
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-avatars')
        .getPublicUrl(filePath);

      console.log('[Avatar] Public URL:', publicUrl);

      const { error: updateError } = await supabase
        .from('clients')
        .update({ avatar_url: publicUrl + '?v=' + Date.now() }) // Cache bust
        .eq('id', clientId);

      if (updateError) {
        console.error('[Avatar] DB update error:', updateError);
        toast.error('Erro ao salvar foto no cliente');
        return { error: updateError };
      }

      toast.success('Foto enviada com sucesso!');
      await fetchClients();
      return { url: publicUrl };
    } catch (error) {
      console.error('[Avatar] Error uploading:', error);
      toast.error('Erro ao enviar foto: ' + (error as Error).message);
      return { error };
    }
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const { error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar cliente');
      return { error };
    }

    toast.success('Cliente atualizado com sucesso!');
    await fetchClients();
    return { success: true };
  };

  const deleteClient = async (id: string) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir cliente');
      return { error };
    }

    toast.success('Cliente excluído com sucesso!');
    await fetchClients();
    return { success: true };
  };

  useEffect(() => {
    fetchClients();
  }, [user, effectiveUserId, employeeLoading]);

  return {
    clients,
    loading,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
    uploadAvatar,
  };
}
