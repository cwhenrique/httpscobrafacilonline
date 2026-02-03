import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loan, LoanPayment, InterestType, LoanPaymentType } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { toast } from 'sonner';
import { updateClientScore } from '@/lib/updateClientScore';

// Query function for fetching third-party loans
const fetchThirdPartyLoansFromDB = async (userId: string): Promise<Loan[]> => {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      client:clients(*),
      loan_payments(id, amount, interest_paid, principal_paid, payment_date)
    `)
    .eq('user_id', userId)
    .eq('is_third_party', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as Loan[];
};

export function useThirdPartyLoans() {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();
  const queryClient = useQueryClient();

  const { 
    data: loans = [], 
    isLoading: loading,
    refetch: fetchLoans
  } = useQuery({
    queryKey: ['third-party-loans', effectiveUserId],
    queryFn: () => fetchThirdPartyLoansFromDB(effectiveUserId!),
    enabled: !!user && !employeeLoading && !!effectiveUserId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const invalidateLoans = () => {
    queryClient.invalidateQueries({ queryKey: ['third-party-loans'] });
    queryClient.invalidateQueries({ queryKey: ['third-party-stats'] });
  };

  const createLoan = async (loan: {
    client_id: string;
    principal_amount: number;
    interest_rate: number;
    interest_type: InterestType;
    interest_mode?: 'per_installment' | 'on_total' | 'compound';
    payment_type: LoanPaymentType;
    installments?: number;
    contract_date?: string;
    start_date: string;
    due_date: string;
    notes?: string;
    installment_dates?: string[];
    remaining_balance?: number;
    total_interest?: number;
    third_party_name: string;
  }) => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    const firstDueDate = loan.installment_dates?.[0] || loan.due_date;
    const dueDate = new Date(firstDueDate + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    dueDate.setHours(12, 0, 0, 0);
    
    const initialStatus: 'pending' | 'overdue' = dueDate < today ? 'overdue' : 'pending';

    const insertData = {
      client_id: loan.client_id,
      principal_amount: loan.principal_amount,
      interest_rate: loan.interest_rate,
      interest_type: loan.interest_type,
      interest_mode: loan.interest_mode || 'on_total',
      payment_type: loan.payment_type,
      installments: loan.installments || 1,
      contract_date: loan.contract_date || new Date().toISOString().split('T')[0],
      start_date: loan.start_date,
      due_date: loan.due_date,
      notes: loan.notes || null,
      user_id: effectiveUserId,
      created_by: user.id,
      remaining_balance: (loan.remaining_balance !== undefined && loan.remaining_balance !== null)
        ? loan.remaining_balance 
        : (loan.principal_amount + (loan.total_interest || 0)),
      total_interest: (loan.total_interest !== undefined && loan.total_interest !== null) 
        ? loan.total_interest 
        : 0,
      total_paid: 0,
      installment_dates: loan.installment_dates || [],
      status: initialStatus,
      is_third_party: true,
      third_party_name: loan.third_party_name,
    };

    const { data, error } = await supabase
      .from('loans')
      .insert(insertData)
      .select(`
        *,
        client:clients(full_name)
      `)
      .single();

    if (error) {
      toast.error('Erro ao criar empréstimo de terceiro');
      return { error };
    }

    toast.success('Empréstimo de terceiro criado com sucesso!');
    
    await updateClientScore(loan.client_id);
    
    invalidateLoans();
    return { data: data as Loan };
  };

  const registerPayment = async (payment: {
    loan_id: string;
    amount: number;
    principal_paid: number;
    interest_paid: number;
    payment_date: string;
    notes?: string;
  }): Promise<{ data?: any; error?: Error; duplicate?: boolean }> => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    if (!payment.amount || isNaN(payment.amount) || !isFinite(payment.amount)) {
      toast.error('Valor do pagamento inválido');
      return { error: new Error('Valor do pagamento inválido') };
    }

    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    
    const { data: recentDuplicate } = await supabase
      .from('loan_payments')
      .select('id, created_at')
      .eq('loan_id', payment.loan_id)
      .eq('amount', payment.amount)
      .gte('created_at', tenSecondsAgo)
      .maybeSingle();
    
    if (recentDuplicate) {
      toast.error('Pagamento já foi registrado. Aguarde alguns segundos.');
      return { error: new Error('Pagamento duplicado detectado'), duplicate: true };
    }

    const { data, error } = await supabase
      .from('loan_payments')
      .insert({
        ...payment,
        user_id: effectiveUserId,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao registrar pagamento');
      return { error };
    }

    toast.success('Pagamento registrado com sucesso!');
    
    const { data: loan } = await supabase
      .from('loans')
      .select('client_id')
      .eq('id', payment.loan_id)
      .single();
    
    if (loan) {
      await updateClientScore(loan.client_id);
    }
    
    invalidateLoans();
    return { data: data as LoanPayment };
  };

  const getLoanPayments = async (loanId: string) => {
    const { data, error } = await supabase
      .from('loan_payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('payment_date', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar pagamentos');
      return { error };
    }

    return { data: data as LoanPayment[] };
  };

  const deleteLoan = async (id: string) => {
    const { error } = await supabase
      .from('loans')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir empréstimo');
      return { error };
    }

    toast.success('Empréstimo excluído com sucesso!');
    invalidateLoans();
    return { success: true };
  };

  const renegotiateLoan = async (id: string, data: {
    interest_rate: number;
    installments: number;
    installment_dates: string[];
    due_date: string;
    notes?: string;
    remaining_balance?: number;
    total_interest?: number;
  }) => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    const sortedDates = [...data.installment_dates].sort((a, b) => 
      new Date(a + 'T12:00:00').getTime() - new Date(b + 'T12:00:00').getTime()
    );

    const updatePayload: Record<string, any> = {
      interest_rate: data.interest_rate,
      installments: data.installments,
      installment_dates: sortedDates,
      due_date: sortedDates[sortedDates.length - 1] || data.due_date,
      notes: data.notes || null,
      status: 'pending',
    };

    if (data.remaining_balance !== undefined) {
      updatePayload.remaining_balance = data.remaining_balance;
    }

    if (data.total_interest !== undefined) {
      updatePayload.total_interest = data.total_interest;
    }

    const { error } = await supabase
      .from('loans')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao renegociar empréstimo');
      return { error };
    }

    toast.success('Empréstimo renegociado com sucesso!');
    
    invalidateLoans();
    return { success: true };
  };

  const updateLoan = async (id: string, data: Partial<Loan>) => {
    const { error } = await supabase
      .from('loans')
      .update(data)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar empréstimo');
      return { error };
    }

    invalidateLoans();
    return { success: true };
  };

  const deletePayment = async (paymentId: string) => {
    const { error } = await supabase
      .from('loan_payments')
      .delete()
      .eq('id', paymentId);

    if (error) {
      toast.error('Erro ao excluir pagamento');
      return { error };
    }

    toast.success('Pagamento excluído com sucesso!');
    invalidateLoans();
    return { success: true };
  };

  return {
    loans,
    loading: loading || employeeLoading,
    fetchLoans,
    createLoan,
    registerPayment,
    getLoanPayments,
    deleteLoan,
    renegotiateLoan,
    updateLoan,
    deletePayment,
  };
}
