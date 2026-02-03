import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { toast } from 'sonner';

export interface ContractExpense {
  id: string;
  contract_id: string;
  user_id: string;
  amount: number;
  expense_date: string;
  category: string;
  description: string | null;
  created_at: string;
}

export interface CreateExpenseData {
  contract_id: string;
  amount: number;
  expense_date: string;
  category: string;
  description?: string;
}

export const EXPENSE_CATEGORIES = [
  { value: 'manutencao', label: 'Manutenção', icon: 'Wrench' },
  { value: 'seguro', label: 'Seguro', icon: 'Shield' },
  { value: 'ipva', label: 'IPVA', icon: 'FileText' },
  { value: 'multa', label: 'Multa', icon: 'AlertTriangle' },
  { value: 'combustivel', label: 'Combustível', icon: 'Fuel' },
  { value: 'pecas', label: 'Peças', icon: 'Cog' },
  { value: 'documentacao', label: 'Documentação', icon: 'File' },
  { value: 'outros', label: 'Outros', icon: 'MoreHorizontal' },
] as const;

export function useContractExpenses(contractId?: string) {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();
  const queryClient = useQueryClient();

  // Query para buscar gastos de um contrato específico
  const { data: expenses = [], isLoading, error } = useQuery({
    queryKey: ['contract_expenses', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      
      const { data, error } = await supabase
        .from('contract_expenses')
        .select('*')
        .eq('contract_id', contractId)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      return data as ContractExpense[];
    },
    enabled: !!user && !employeeLoading && !!contractId,
  });

  // Query para buscar TODOS os gastos do usuário (para calcular totais nos cards)
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['all_contract_expenses', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      
      const { data, error } = await supabase
        .from('contract_expenses')
        .select('*');

      if (error) throw error;
      return data as ContractExpense[];
    },
    enabled: !!user && !employeeLoading && !!effectiveUserId,
  });

  const createExpense = useMutation({
    mutationFn: async (expenseData: CreateExpenseData) => {
      if (!effectiveUserId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('contract_expenses')
        .insert({
          ...expenseData,
          user_id: effectiveUserId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['all_contract_expenses'] });
      toast.success('Gasto registrado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar gasto: ' + error.message);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('contract_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['all_contract_expenses'] });
      toast.success('Gasto excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir gasto: ' + error.message);
    },
  });

  // Helper para calcular total de gastos por contrato
  const getTotalExpensesByContract = (contractId: string): number => {
    return allExpenses
      .filter(e => e.contract_id === contractId)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  };

  // Helper para obter gastos agrupados por categoria
  const getExpensesByCategory = (contractId: string) => {
    const contractExpenses = allExpenses.filter(e => e.contract_id === contractId);
    const byCategory: Record<string, number> = {};
    
    contractExpenses.forEach(expense => {
      const category = expense.category || 'outros';
      byCategory[category] = (byCategory[category] || 0) + Number(expense.amount);
    });
    
    return byCategory;
  };

  return {
    expenses,
    allExpenses,
    isLoading,
    error,
    createExpense,
    deleteExpense,
    getTotalExpensesByContract,
    getExpensesByCategory,
  };
}
