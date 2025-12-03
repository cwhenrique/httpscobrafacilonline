import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loan, LoanPayment, InterestType, LoanPaymentType } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { updateClientScore } from '@/lib/updateClientScore';

// Helper to create notification
const createNotificationRecord = async (
  userId: string,
  notification: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    loan_id?: string;
    client_id?: string;
  }
) => {
  await supabase.from('notifications').insert({
    user_id: userId,
    ...notification,
  });
};

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
    
    // Update client score after creating loan
    await updateClientScore(loan.client_id);
    
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
    
    // Get the loan to find client_id and update their score
    const { data: loan } = await supabase
      .from('loans')
      .select('client_id, remaining_balance, principal_amount, clients(full_name)')
      .eq('id', payment.loan_id)
      .single();
    
    if (loan) {
      await updateClientScore(loan.client_id);
      
      // Create notification for payment received
      const clientName = (loan.clients as any)?.full_name || 'Cliente';
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(payment.amount);
      
      const isPaidOff = (loan.remaining_balance - payment.principal_paid) <= 0;
      
      await createNotificationRecord(user.id, {
        title: isPaidOff ? '✅ Empréstimo Quitado!' : '💰 Pagamento Recebido',
        message: isPaidOff 
          ? `${clientName} quitou o empréstimo de ${formattedAmount}`
          : `${clientName} realizou um pagamento de ${formattedAmount}`,
        type: 'success',
        loan_id: payment.loan_id,
        client_id: loan.client_id,
      });
    }
    
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

  const renegotiateLoan = async (id: string, data: {
    interest_rate: number;
    installments: number;
    installment_dates: string[];
    due_date: string;
    notes?: string;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    const { error } = await supabase
      .from('loans')
      .update({
        interest_rate: data.interest_rate,
        installments: data.installments,
        installment_dates: data.installment_dates,
        due_date: data.due_date,
        notes: data.notes,
        status: 'pending',
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao renegociar empréstimo');
      return { error };
    }

    toast.success('Empréstimo renegociado com sucesso!');
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
    renegotiateLoan,
  };
}
