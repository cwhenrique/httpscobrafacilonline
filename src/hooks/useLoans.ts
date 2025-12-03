import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loan, LoanPayment, InterestType, LoanPaymentType } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchLoans = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        client:clients(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar empréstimos');
      console.error(error);
    } else {
      setLoans(data as Loan[]);
    }
    setLoading(false);
  };

  const createLoan = async (loan: {
    client_id: string;
    principal_amount: number;
    interest_rate: number;
    interest_type: InterestType;
    interest_mode?: 'per_installment' | 'on_total';
    payment_type: LoanPaymentType;
    installments?: number;
    start_date: string;
    due_date: string;
    notes?: string;
    installment_dates?: string[];
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('loans')
      .insert({
        ...loan,
        user_id: user.id,
        remaining_balance: loan.principal_amount,
        total_interest: 0,
        total_paid: 0,
        installment_dates: loan.installment_dates || [],
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar empréstimo');
      return { error };
    }

    toast.success('Empréstimo criado com sucesso!');
    await fetchLoans();
    return { data: data as Loan };
  };

  const registerPayment = async (payment: {
    loan_id: string;
    amount: number;
    principal_paid: number;
    interest_paid: number;
    payment_date: string;
    notes?: string;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('loan_payments')
      .insert({
        ...payment,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao registrar pagamento');
      return { error };
    }

    toast.success('Pagamento registrado com sucesso!');
    await fetchLoans();
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
    await fetchLoans();
    return { success: true };
  };

  useEffect(() => {
    fetchLoans();
  }, [user]);

  return {
    loans,
    loading,
    fetchLoans,
    createLoan,
    registerPayment,
    getLoanPayments,
    deleteLoan,
  };
}
