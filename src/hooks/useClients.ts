import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, ClientType } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchClients = async () => {
    if (!user) return;
    
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
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...client,
        user_id: user.id,
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
  }, [user]);

  return {
    clients,
    loading,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
  };
}
