import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loan, LoanPayment, InterestType, LoanPaymentType } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { toast } from 'sonner';
import { updateClientScore } from '@/lib/updateClientScore';
import { format, subMonths, subWeeks, subDays } from 'date-fns';

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

  // Buscar informações dos funcionários criadores
  const creatorIds = [...new Set((data || []).map(l => l.created_by).filter(Boolean))];
  const { data: employees } = await supabase
    .from('employees')
    .select('employee_user_id, name, email')
    .in('employee_user_id', creatorIds);
  
  const employeeMap = new Map(employees?.map(e => [e.employee_user_id, { name: e.name, email: e.email }]) || []);
  
  // Mapear creator_employee para cada loan
  return (data || []).map(loan => ({
    ...loan,
    creator_employee: loan.created_by !== loan.user_id 
      ? employeeMap.get(loan.created_by) || null 
      : null
  })) as Loan[];
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
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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
    third_party_name?: string;
    send_creation_notification?: boolean;
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
      third_party_name: loan.third_party_name || 'Terceiro',
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

  const updateLoan = async (id: string, data: {
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
    total_paid?: number;
    third_party_name?: string;
  }) => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    const updateData = {
      client_id: data.client_id,
      principal_amount: data.principal_amount,
      interest_rate: data.interest_rate,
      interest_type: data.interest_type,
      interest_mode: data.interest_mode || 'on_total',
      payment_type: data.payment_type,
      installments: data.installments || 1,
      contract_date: data.contract_date || null,
      start_date: data.start_date,
      due_date: data.due_date,
      notes: data.notes || null,
      installment_dates: data.installment_dates || [],
      remaining_balance: data.remaining_balance !== undefined ? data.remaining_balance : data.principal_amount,
      total_interest: data.total_interest !== undefined ? data.total_interest : 0,
      ...(data.total_paid !== undefined && { total_paid: data.total_paid }),
      ...(data.third_party_name && { third_party_name: data.third_party_name }),
    };

    const { error } = await supabase
      .from('loans')
      .update(updateData)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar empréstimo');
      return { error };
    }

    toast.success('Empréstimo atualizado com sucesso!');
    invalidateLoans();
    return { success: true };
  };

  const deletePayment = async (paymentId: string, loanId: string) => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    // 1. Fetch payment data first
    const { data: paymentData, error: fetchError } = await supabase
      .from('loan_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !paymentData) {
      toast.error('Erro ao buscar dados do pagamento');
      return { error: fetchError || new Error('Pagamento não encontrado') };
    }

    // 2. Get current loan data
    const { data: loanData, error: loanError } = await supabase
      .from('loans')
      .select('*, client:clients(full_name)')
      .eq('id', loanId)
      .single();

    if (loanError || !loanData) {
      toast.error('Erro ao buscar dados do empréstimo');
      return { error: loanError || new Error('Empréstimo não encontrado') };
    }

    const paymentNotes = paymentData.notes || '';
    let updatedLoanNotes = loanData.notes || '';
    let notesChanged = false;

    // Check for amortization reversal
    const amortReversalMatch = paymentNotes.match(/\[AMORT_REVERSAL:([0-9.]+):([0-9.]+):([0-9.]+)\]/);
    if (amortReversalMatch) {
      const previousTotalInterest = parseFloat(amortReversalMatch[2]);
      const previousRemainingBalance = parseFloat(amortReversalMatch[3]);
      
      const amortTagRegex = /\[AMORTIZATION:[^\]]+\]/g;
      const allAmortTags = updatedLoanNotes.match(amortTagRegex) || [];
      if (allAmortTags.length > 0) {
        const lastTag = allAmortTags[allAmortTags.length - 1];
        updatedLoanNotes = updatedLoanNotes.replace(lastTag, '').trim();
      }
      
      updatedLoanNotes = updatedLoanNotes.replace(/\n{3,}/g, '\n\n').trim();
      
      await supabase.from('loans').update({
        total_interest: previousTotalInterest,
        remaining_balance: previousRemainingBalance,
        notes: updatedLoanNotes || null
      }).eq('id', loanId);
      
      const { error: deleteError } = await supabase
        .from('loan_payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        toast.error('Erro ao excluir amortização');
        return { error: deleteError };
      }

      await updateClientScore(loanData.client_id);
      toast.success('Amortização revertida! Contrato restaurado ao estado anterior.');
      invalidateLoans();
      return { success: true };
    }

    // 3. Delete the payment record (trigger handles reversal)
    const { error: deleteError } = await supabase
      .from('loan_payments')
      .delete()
      .eq('id', paymentId);

    if (deleteError) {
      toast.error('Erro ao excluir pagamento');
      return { error: deleteError };
    }

    // Clean up tracking tags
    const subparcelaPaidMatch = paymentNotes.match(/Sub-parcela \(Adiant\. P(\d+)\)/);
    if (subparcelaPaidMatch) {
      const originalIndex = parseInt(subparcelaPaidMatch[1]) - 1;
      const paidTagRegex = new RegExp(
        `\\[ADVANCE_SUBPARCELA_PAID:${originalIndex}:([0-9.]+):([^:\\]]+)(?::(\\d+))?\\]`,
        'g'
      );
      const newNotes = updatedLoanNotes.replace(paidTagRegex, (match, amount, date, id) => {
        return `[ADVANCE_SUBPARCELA:${originalIndex}:${amount}:${date}${id ? ':' + id : ''}]`;
      });
      if (newNotes !== updatedLoanNotes) {
        updatedLoanNotes = newNotes;
        notesChanged = true;
      }
    }
    
    const advanceMatch = paymentNotes.match(/Adiantamento - Parcela (\d+)/);
    if (advanceMatch) {
      const installmentIndex = parseInt(advanceMatch[1]) - 1;
      let newNotes = updatedLoanNotes.replace(
        new RegExp(`\\[PARTIAL_PAID:${installmentIndex}:[0-9.]+\\]`, 'g'), 
        ''
      );
      newNotes = newNotes.replace(
        new RegExp(`\\[ADVANCE_SUBPARCELA:${installmentIndex}:[^\\]]+\\]`, 'g'), 
        ''
      );
      newNotes = newNotes.replace(
        new RegExp(`\\[ADVANCE_SUBPARCELA_PAID:${installmentIndex}:[^\\]]+\\]`, 'g'), 
        ''
      );
      if (newNotes !== updatedLoanNotes) {
        updatedLoanNotes = newNotes;
        notesChanged = true;
      }
    }
    
    const parcelaMatch = paymentNotes.match(/Parcela (\d+)(?:\/| de )\d+/);
    if (parcelaMatch && !advanceMatch && !subparcelaPaidMatch && !paymentNotes.includes('[AMORTIZATION]')) {
      const installmentIndex = parseInt(parcelaMatch[1]) - 1;
      let newNotes = updatedLoanNotes.replace(
        new RegExp(`\\[PARTIAL_PAID:${installmentIndex}:[0-9.]+\\]`, 'g'), 
        ''
      );
      newNotes = newNotes.replace(
        new RegExp(`\\[OVERDUE_INTEREST_PAID:${installmentIndex}:[^\\]]+\\]`, 'g'),
        ''
      );
      if (newNotes !== updatedLoanNotes) {
        updatedLoanNotes = newNotes;
        notesChanged = true;
      }
    }
    
    const isInterestOnlyPayment = paymentNotes.includes('[INTEREST_ONLY_PAYMENT]');
    
    if (isInterestOnlyPayment) {
      let newNotes = updatedLoanNotes.replace(/\[INTEREST_ONLY_PAYMENT\]\n?/g, '');
      const interestOnlyTags = newNotes.match(/\[INTEREST_ONLY_PAID:\d+:[0-9.]+:[^\]]+\]/g) || [];
      if (interestOnlyTags.length > 0) {
        const lastTag = interestOnlyTags[interestOnlyTags.length - 1];
        newNotes = newNotes.replace(lastTag, '');
      }
      newNotes = newNotes.replace(/\n{3,}/g, '\n\n').trim();
      
      const currentDates = (loanData.installment_dates as string[]) || [];
      if (currentDates.length > 0) {
        const paymentType = loanData.payment_type;
        const revertedDates = currentDates.map(dateStr => {
          const date = new Date(dateStr + 'T12:00:00');
          let newDate: Date;
          if (paymentType === 'weekly') {
            newDate = subWeeks(date, 1);
          } else if (paymentType === 'biweekly') {
            newDate = subDays(date, 15);
          } else if (paymentType === 'daily') {
            newDate = subDays(date, 1);
          } else {
            newDate = subMonths(date, 1);
          }
          return format(newDate, 'yyyy-MM-dd');
        });
        
        const newDueDate = revertedDates[0] || loanData.due_date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDateObj = new Date(newDueDate + 'T12:00:00');
        const newStatus = dueDateObj < today ? 'overdue' : 'pending';
        
        await supabase.from('loans').update({
          installment_dates: revertedDates,
          due_date: newDueDate,
          status: newStatus,
          notes: newNotes || null
        }).eq('id', loanId);
        
        notesChanged = false;
      }
    }
    
    if (notesChanged) {
      updatedLoanNotes = updatedLoanNotes.replace(/\n{3,}/g, '\n\n').trim();
      
      const { data: freshLoan } = await supabase
        .from('loans')
        .select('due_date')
        .eq('id', loanId)
        .single();
      
      const currentDueDate = freshLoan?.due_date || loanData.due_date;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDateObj = new Date(currentDueDate + 'T12:00:00');
      const newStatus = dueDateObj < today ? 'overdue' : 'pending';
      
      await supabase
        .from('loans')
        .update({ 
          notes: updatedLoanNotes || null,
          status: newStatus
        })
        .eq('id', loanId);
    }

    await updateClientScore(loanData.client_id);
    toast.success('Pagamento excluído e saldo restaurado!');
    invalidateLoans();
    return { success: true };
  };

  // Update payment date
  const updatePaymentDate = async (paymentId: string, newDate: string) => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    const { error } = await supabase
      .from('loan_payments')
      .update({ payment_date: newDate })
      .eq('id', paymentId);

    if (error) {
      toast.error('Erro ao atualizar data do pagamento');
      return { error };
    }

    toast.success('Data do pagamento atualizada!');
    invalidateLoans();
    return { success: true };
  };

  // Add extra installments to a daily loan
  const addExtraInstallments = async (
    loanId: string,
    extraCount: number,
    newDates: string[]
  ) => {
    if (!user || !effectiveUserId) return { error: new Error('Usuário não autenticado') };

    const { data: loanData, error: fetchError } = await supabase
      .from('loans')
      .select('*, clients(full_name)')
      .eq('id', loanId)
      .single();

    if (fetchError || !loanData) {
      toast.error('Erro ao buscar dados do empréstimo');
      return { error: fetchError || new Error('Empréstimo não encontrado') };
    }

    const currentDates = (loanData.installment_dates as string[]) || [];
    const allDates = [...currentDates, ...newDates];
    const newInstallments = loanData.installments + extraCount;
    const dailyAmount = loanData.total_interest || 0;
    const extraValue = dailyAmount * extraCount;
    const newRemainingBalance = loanData.remaining_balance + extraValue;
    const newDueDate = allDates[allDates.length - 1] || loanData.due_date;

    const today = new Date().toISOString().split('T')[0];
    const extraTag = `[EXTRA_INSTALLMENTS:${extraCount}:${today}]`;
    const newNotes = loanData.notes 
      ? `${loanData.notes}\n${extraTag}` 
      : extraTag;

    const { error: updateError } = await supabase
      .from('loans')
      .update({
        installments: newInstallments,
        installment_dates: allDates,
        remaining_balance: newRemainingBalance,
        due_date: newDueDate,
        notes: newNotes,
        status: 'pending',
      })
      .eq('id', loanId);

    if (updateError) {
      toast.error('Erro ao adicionar parcelas extras');
      return { error: updateError };
    }

    toast.success(`${extraCount} parcela(s) extra(s) adicionada(s)!`);
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
    updatePaymentDate,
    addExtraInstallments,
    invalidateLoans,
  };
}
