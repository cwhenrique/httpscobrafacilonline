import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Client, ClientType } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { toast } from 'sonner';

async function fetchClientsFromDB(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('full_name');

  if (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }
  
  return (data || []) as Client[];
}

export function useClients() {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['clients', effectiveUserId],
    queryFn: fetchClientsFromDB,
    enabled: !!user && !employeeLoading && !!effectiveUserId,
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos
  });

  const fetchClients = useCallback(() => {
    refetch();
  }, [refetch]);

  const invalidateClients = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }, [queryClient]);

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
        created_by: user.id, // Track who created the client
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar cliente');
      return { error };
    }

    toast.success('Cliente criado com sucesso!');
    invalidateClients();
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
        .update({ avatar_url: publicUrl + '?v=' + Date.now() })
        .eq('id', clientId);

      if (updateError) {
        console.error('[Avatar] DB update error:', updateError);
        toast.error('Erro ao salvar foto no cliente');
        return { error: updateError };
      }

      toast.success('Foto enviada com sucesso!');
      invalidateClients();
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
    invalidateClients();
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
    invalidateClients();
    return { success: true };
  };

  return {
    clients,
    loading,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
    uploadAvatar,
    invalidateClients,
  };
}
