import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';

export interface IPTVPlan {
  id: string;
  user_id: string;
  name: string;
  price: number;
  max_devices: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateIPTVPlanData {
  name: string;
  price: number;
  max_devices?: number;
  description?: string;
}

export interface UpdateIPTVPlanData {
  name?: string;
  price?: number;
  max_devices?: number;
  description?: string;
  is_active?: boolean;
}

export function useIPTVPlans() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { effectiveUserId } = useEmployeeContext();

  const userId = effectiveUserId || user?.id;

  // Fetch all IPTV plans
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['iptv-plans', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('iptv_plans')
        .select('*')
        .eq('user_id', userId)
        .order('price', { ascending: true });

      if (error) throw error;
      return data as IPTVPlan[];
    },
    enabled: !!userId,
  });

  // Get active plans only
  const activePlans = plans.filter(p => p.is_active);

  // Create plan
  const createPlan = useMutation({
    mutationFn: async (data: CreateIPTVPlanData) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const { data: newPlan, error } = await supabase
        .from('iptv_plans')
        .insert({
          user_id: userId,
          name: data.name,
          price: data.price,
          max_devices: data.max_devices || 1,
          description: data.description || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return newPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iptv-plans'] });
      toast.success('Plano criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating plan:', error);
      toast.error('Erro ao criar plano');
    },
  });

  // Update plan
  const updatePlan = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateIPTVPlanData }) => {
      const { error } = await supabase
        .from('iptv_plans')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iptv-plans'] });
      toast.success('Plano atualizado!');
    },
    onError: (error: Error) => {
      console.error('Error updating plan:', error);
      toast.error('Erro ao atualizar plano');
    },
  });

  // Delete plan
  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('iptv_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iptv-plans'] });
      toast.success('Plano excluído!');
    },
    onError: (error: Error) => {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao excluir plano');
    },
  });

  // Toggle plan active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('iptv_plans')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['iptv-plans'] });
      toast.success(variables.is_active ? 'Plano ativado!' : 'Plano desativado!');
    },
    onError: (error: Error) => {
      console.error('Error toggling plan:', error);
      toast.error('Erro ao alterar status');
    },
  });

  return {
    plans,
    activePlans,
    isLoading,
    createPlan,
    updatePlan,
    deletePlan,
    toggleActive,
  };
}
