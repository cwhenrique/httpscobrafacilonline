import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoanPayment } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';

async function fetchPaymentsFromDB(limit: number = 100): Promise<LoanPayment[]> {
  const { data, error } = await supabase
    .from('loan_payments')
    .select('*')
    .order('payment_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro ao carregar pagamentos:', error);
    throw error;
  }
  
  return (data || []) as LoanPayment[];
}

export function useAllPayments(limit: number = 100) {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['all-payments', effectiveUserId, limit],
    queryFn: () => fetchPaymentsFromDB(limit),
    enabled: !!user && !employeeLoading && !!effectiveUserId,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 5, // 5 minutos
  });

  const fetchPayments = () => {
    refetch();
  };

  const invalidatePayments = () => {
    queryClient.invalidateQueries({ queryKey: ['all-payments'] });
  };

  return {
    payments,
    loading,
    fetchPayments,
    invalidatePayments,
  };
}
