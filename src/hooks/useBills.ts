import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PaymentStatus } from '@/types/database';

export type BillCategory = 
  | 'energia'
  | 'agua'
  | 'internet'
  | 'telefone'
  | 'cartao'
  | 'aluguel'
  | 'financiamento'
  | 'seguro'
  | 'servicos'
  | 'streaming'
  | 'supermercado'
  | 'saude'
  | 'educacao'
  | 'outros';

export interface Bill {
  id: string;
  user_id: string;
  description: string;
  payee_name: string;
  amount: number;
  due_date: string;
  status: PaymentStatus;
  paid_date: string | null;
  notes: string | null;
  category: BillCategory;
  is_recurring: boolean;
  recurrence_months: number | null;
  pix_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBillData {
  description: string;
  payee_name: string;
  amount: number;
  due_date: string;
  category?: BillCategory;
  is_recurring?: boolean;
  recurrence_months?: number | null;
  pix_key?: string;
  notes?: string;
}

export interface UpdateBillData {
  description?: string;
  payee_name?: string;
  amount?: number;
  due_date?: string;
  status?: PaymentStatus;
  paid_date?: string | null;
  category?: BillCategory;
  is_recurring?: boolean;
  recurrence_months?: number | null;
  pix_key?: string;
  notes?: string;
}

export function useBills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bills = [], isLoading, error } = useQuery({
    queryKey: ['bills', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as Bill[];
    },
    enabled: !!user?.id,
  });

  const createBill = useMutation({
    mutationFn: async (data: CreateBillData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data: newBill, error } = await supabase
        .from('bills')
        .insert({
          user_id: user.id,
          description: data.description,
          payee_name: data.payee_name,
          amount: data.amount,
          due_date: data.due_date,
          category: data.category || 'outros',
          is_recurring: data.is_recurring || false,
          recurrence_months: data.recurrence_months ?? null,
          pix_key: data.pix_key || null,
          notes: data.notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return newBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Conta cadastrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar conta: ' + error.message);
    },
  });

  const updateBill = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateBillData }) => {
      const { data: updated, error } = await supabase
        .from('bills')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Conta atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar conta: ' + error.message);
    },
  });

  const deleteBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Conta excluída com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir conta: ' + error.message);
    },
  });

  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      const { data: updated, error } = await supabase
        .from('bills')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Conta marcada como paga!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao marcar conta como paga: ' + error.message);
    },
  });

  return {
    bills,
    isLoading,
    error,
    createBill,
    updateBill,
    deleteBill,
    markAsPaid,
  };
}
