import { useQuery, useQueryClient } from '@tanstack/react-query';
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

// Função para limpar tags internas das notas antes de enviar em mensagens
const cleanNotesForMessage = (notes: string | null): string => {
  if (!notes) return '';
  
  return notes
    // Remove tags de pagamento parcial
    .replace(/\[PARTIAL_PAID:[^\]]+\]/g, '')
    // Remove tags de taxa de renovação
    .replace(/\[RENEWAL_FEE_INSTALLMENT:[^\]]+\]/g, '')
    // Remove tags de contrato histórico
    .replace(/\[HISTORICAL_CONTRACT\]/g, '')
    // Remove tags de pagamento só juros
    .replace(/\[INTEREST_ONLY_PAYMENT\]/g, '')
    // Remove tags de configuração de multa
    .replace(/\[OVERDUE_CONFIG:[^\]]+\]/g, '')
    // Remove linha de "Taxa extra" legível (é interna, já mostrado de outra forma)
    .replace(/Taxa extra:.*?(?:\n|$)/g, '')
    // Remove linha de "Valor que falta" interno
    .replace(/Valor que falta: R\$ [0-9.,]+\n?/g, '')
    // Remove linha de "Valor prometido" interno
    .replace(/Valor prometido: R\$ [0-9.,]+\n?/g, '')
    // Limpa linhas vazias extras
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Helper to send WhatsApp via edge function
const sendWhatsAppNotification = async (phone: string, message: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: { phone, message },
    });
    
    if (error) {
      console.error('Error sending WhatsApp:', error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error('Failed to send WhatsApp notification:', error);
    return false;
  }
};

// Helper to get user profile phone
const getUserPhone = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('profiles')
    .select('phone, full_name')
    .eq('id', userId)
    .single();
  
  return data?.phone || null;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
};

// Query function for fetching loans
const fetchLoansFromDB = async (userId: string): Promise<Loan[]> => {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      client:clients(*),
      loan_payments(interest_paid)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  
  return data as Loan[];
};

export function useLoans() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use React Query for fetching loans with shared cache
  const { 
    data: loans = [], 
    isLoading: loading,
    refetch: fetchLoans
  } = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => fetchLoansFromDB(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Function to invalidate loans cache - all components using useLoans will be updated
  const invalidateLoans = () => {
    queryClient.invalidateQueries({ queryKey: ['loans'] });
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
    send_creation_notification?: boolean;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    console.log('createLoan received loan object:', JSON.stringify(loan, null, 2));
    console.log('loan.remaining_balance:', loan.remaining_balance, 'type:', typeof loan.remaining_balance);
    console.log('loan.total_interest:', loan.total_interest, 'type:', typeof loan.total_interest);
    console.log('loan.interest_rate:', loan.interest_rate, 'type:', typeof loan.interest_rate);

    // Verificar se contrato já nasce em atraso (due_date no passado)
    const isHistoricalContract = loan.notes?.includes('[HISTORICAL_CONTRACT]');
    const firstDueDate = loan.installment_dates?.[0] || loan.due_date;
    // Adiciona T12:00:00 para evitar problemas de timezone (UTC vs local)
    const dueDate = new Date(firstDueDate + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    dueDate.setHours(12, 0, 0, 0);
    
    // Definir status inicial: 'overdue' se não é histórico e due_date < hoje
    const initialStatus: 'pending' | 'overdue' = (!isHistoricalContract && dueDate < today) ? 'overdue' : 'pending';

    // Build insert object explicitly to ensure daily loan values are preserved
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
      user_id: user.id,
      remaining_balance: (loan.remaining_balance !== undefined && loan.remaining_balance !== null) 
        ? loan.remaining_balance 
        : (loan.principal_amount + (loan.total_interest || 0)),
      total_interest: (loan.total_interest !== undefined && loan.total_interest !== null) 
        ? loan.total_interest 
        : 0,
      total_paid: 0,
      installment_dates: loan.installment_dates || [],
      status: initialStatus,
    };

    console.log('insertData being sent to Supabase:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabase
      .from('loans')
      .insert(insertData)
      .select(`
        *,
        client:clients(full_name)
      `)
      .single();

    if (error) {
      toast.error('Erro ao criar empréstimo');
      return { error };
    }

    toast.success('Empréstimo criado com sucesso!');
    
    // Update client score after creating loan
    await updateClientScore(loan.client_id);
    
    // WhatsApp notifications removed - only sent via explicit user click
    
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
    send_notification?: boolean;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    // Extract send_notification before inserting (not a DB column)
    const { send_notification, ...paymentData } = payment;

    const { data, error } = await supabase
      .from('loan_payments')
      .insert({
        ...paymentData,
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
      .select('client_id, remaining_balance, principal_amount, interest_rate, interest_mode, installments, total_paid, clients(full_name)')
      .eq('id', payment.loan_id)
      .single();
    
    if (loan) {
      await updateClientScore(loan.client_id);
      
      const clientName = (loan.clients as any)?.full_name || 'Cliente';
      
      // USAR VALORES DO BANCO DE DADOS como fonte de verdade
      // remaining_balance no DB já é atualizado pelo trigger update_loan_on_payment
      const newTotalPaid = loan.total_paid || 0;
      
      // remaining_balance é a fonte de verdade - já inclui principal + juros - pagamentos
      const remainingToReceive = loan.remaining_balance || 0;
      const isPaidOff = remainingToReceive <= 0;
      
      // Detect interest-only payment
      const isInterestOnlyPayment = payment.notes?.includes('[INTEREST_ONLY_PAYMENT]');
      
      // Create notification for payment received
      await createNotificationRecord(user.id, {
        title: isInterestOnlyPayment 
          ? '💰 Pagamento de Juros' 
          : (isPaidOff ? '✅ Empréstimo Quitado!' : '💰 Pagamento Recebido'),
        message: isInterestOnlyPayment
          ? `${clientName} pagou R$ ${formatCurrency(payment.amount)} de juros`
          : (isPaidOff 
              ? `${clientName} quitou o empréstimo de ${formatCurrency(payment.amount)}`
              : `${clientName} realizou um pagamento de ${formatCurrency(payment.amount)}`),
        type: 'success',
        loan_id: payment.loan_id,
        client_id: loan.client_id,
      });
      
      // Send WhatsApp notification for payment received - only if enabled
      if (send_notification) {
        const phone = await getUserPhone(user.id);
        if (phone) {
          let message: string;
          
          if (isPaidOff) {
            message = `🎉 *Empréstimo Quitado!*\n\n`;
            message += `👤 Cliente: *${clientName}*\n`;
            message += `💰 Último pagamento: *${formatCurrency(payment.amount)}*\n`;
            message += `📅 Data: *${formatDate(payment.payment_date)}*\n`;
            message += `✅ Total recebido: *${formatCurrency(newTotalPaid)}*\n\n`;
            message += `Parabéns! Empréstimo totalmente quitado! 🙌\n\n`;
            message += `_CobraFácil - Confirmação automática_`;
          } else {
            message = `💵 *Pagamento Recebido*\n\n`;
            message += `👤 Cliente: *${clientName}*\n`;
            message += `💰 Valor: *${formatCurrency(payment.amount)}*\n`;
            message += `📅 Data: *${formatDate(payment.payment_date)}*\n\n`;
            message += `📊 *Situação atual:*\n`;
            message += `- Pago: ${formatCurrency(newTotalPaid)}\n`;
            message += `- Restante: ${formatCurrency(remainingToReceive > 0 ? remainingToReceive : 0)}\n\n`;
            message += `_CobraFácil - Confirmação automática_`;
          }
          
          await sendWhatsAppNotification(phone, message);
        }
      }
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
    send_notification?: boolean;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    // Get loan info before update for notification
    const { data: loanData } = await supabase
      .from('loans')
      .select('principal_amount, interest_mode, total_paid, clients(full_name)')
      .eq('id', id)
      .single();

    const updatePayload: Record<string, any> = {
      interest_rate: data.interest_rate,
      installments: data.installments,
      installment_dates: data.installment_dates,
      due_date: data.due_date,
      notes: data.notes,
      status: 'pending',
    };

    // Se remaining_balance foi passado, atualizar também
    if (data.remaining_balance !== undefined) {
      updatePayload.remaining_balance = data.remaining_balance;
    }

    // Se total_interest foi passado, atualizar também (importante para empréstimos diários)
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
    
    // Send WhatsApp notification for renegotiation
    if (loanData) {
      const clientName = (loanData.clients as any)?.full_name || 'Cliente';
      const numInstallments = data.installments || 1;
      
      // Calculate total interest based on interest_mode
      let totalInterest = 0;
      if (loanData.interest_mode === 'on_total') {
        totalInterest = loanData.principal_amount * (data.interest_rate / 100);
      } else if (loanData.interest_mode === 'compound') {
        // Usar fórmula PMT de amortização (Sistema Price)
        const i = data.interest_rate / 100;
        if (i === 0 || !isFinite(i)) {
          totalInterest = 0;
        } else {
          const factor = Math.pow(1 + i, numInstallments);
          const pmt = loanData.principal_amount * (i * factor) / (factor - 1);
          totalInterest = (pmt * numInstallments) - loanData.principal_amount;
        }
      } else {
        totalInterest = loanData.principal_amount * (data.interest_rate / 100) * numInstallments;
      }
      
      const totalToReceive = loanData.principal_amount + totalInterest;
      const totalPaid = loanData.total_paid || 0;
      const remainingToReceive = totalToReceive - totalPaid;
      
      // Send WhatsApp notification for renegotiation - only if enabled
      if (data.send_notification) {
        const phone = await getUserPhone(user.id);
        if (phone) {
          let message = `🔄 *Empréstimo Renegociado*\n\n`;
          message += `👤 Cliente: *${clientName}*\n`;
          message += `💰 Valor original: *${formatCurrency(loanData.principal_amount)}*\n`;
          message += `📊 Nova taxa: *${data.interest_rate}% por parcela*\n`;
          message += `📅 Novas parcelas: *${numInstallments}x*\n`;
          if (data.installment_dates && data.installment_dates.length > 0) {
            message += `⏰ Próximo vencimento: *${formatDate(data.installment_dates[0])}*\n`;
          }
          message += `💵 Total a receber: *${formatCurrency(remainingToReceive > 0 ? remainingToReceive : 0)}*\n`;
          const cleanedNotes = cleanNotesForMessage(data.notes || null);
          if (cleanedNotes) {
            message += `📝 Obs: ${cleanedNotes}\n`;
          }
          message += `\n_CobraFácil - Renegociação registrada_`;
          
          await sendWhatsAppNotification(phone, message);
        }
      }
    }
    
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
    send_notification?: boolean;
    is_renegotiation?: boolean;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    // Get loan info before update for notification
    const { data: oldLoanData } = await supabase
      .from('loans')
      .select('*, clients(full_name)')
      .eq('id', id)
      .single();

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
    
    // Get updated loan data for notification
    const { data: newLoanData } = await supabase
      .from('loans')
      .select('*, clients(full_name)')
      .eq('id', id)
      .single();

    // Send WhatsApp notification for loan update - only if enabled
    if (newLoanData && data.send_notification) {
      const clientName = (newLoanData.clients as any)?.full_name || 'Cliente';
      const numInstallments = data.installments || 1;
      
      // Calculate total interest based on interest_mode
      let totalInterest = 0;
      if (data.interest_mode === 'on_total') {
        totalInterest = data.principal_amount * (data.interest_rate / 100);
      } else if (data.interest_mode === 'compound') {
        // Usar fórmula PMT de amortização (Sistema Price)
        const i = data.interest_rate / 100;
        if (i === 0 || !isFinite(i)) {
          totalInterest = 0;
        } else {
          const factor = Math.pow(1 + i, numInstallments);
          const pmt = data.principal_amount * (i * factor) / (factor - 1);
          totalInterest = (pmt * numInstallments) - data.principal_amount;
        }
      } else {
        totalInterest = data.principal_amount * (data.interest_rate / 100) * numInstallments;
      }
      
      const totalToReceive = data.principal_amount + totalInterest;
      const installmentValue = totalToReceive / numInstallments;
      
      const phone = await getUserPhone(user.id);
      if (phone) {
        let message = '';
        
        if (data.is_renegotiation) {
          // Mensagem específica de renegociação com lista de parcelas
          const contractId = `EMP-${id.substring(0, 4).toUpperCase()}`;
          
          message = `⚠️ *CONTRATO RENEGOCIADO - ${contractId}*\n\n`;
          message += `👤 Cliente: *${clientName}*\n\n`;
          message += `💰 *Novo Contrato:*\n`;
          message += `- Valor Principal: ${formatCurrency(data.principal_amount)}\n`;
          message += `- Taxa de Juros: ${data.interest_rate}%\n`;
          message += `- Total a Receber: ${formatCurrency(totalToReceive)}\n\n`;
          
          message += `📅 *Novas Parcelas:*\n`;
          const installmentDates = data.installment_dates || [];
          for (let i = 0; i < numInstallments; i++) {
            const dueDate = installmentDates[i] || data.due_date;
            message += `📌 Parcela ${i + 1}/${numInstallments}: ${formatCurrency(installmentValue)} - Venc: ${formatDate(dueDate)}\n`;
          }
          
          message += `\n✅ O contrato anterior foi quitado.\n`;
          message += `🔄 Este é um novo ciclo de pagamentos.\n`;
          message += `\n_CobraFácil - Renegociação registrada_`;
        } else {
          // Mensagem padrão de edição
          const totalPaid = newLoanData.total_paid || 0;
          const remainingToReceive = totalToReceive - totalPaid;
          
          message = `✏️ *Empréstimo Editado*\n\n`;
          message += `👤 Cliente: *${clientName}*\n`;
          message += `💰 Valor: *${formatCurrency(data.principal_amount)}*\n`;
          message += `📊 Juros: *${data.interest_rate}%*\n`;
          message += `📅 Parcelas: *${numInstallments}x*\n`;
          message += `📅 Vencimento: *${formatDate(data.due_date)}*\n`;
          message += `💵 Total a receber: *${formatCurrency(totalToReceive)}*\n`;
          message += `💵 Restante: *${formatCurrency(remainingToReceive > 0 ? remainingToReceive : 0)}*\n`;
          const cleanedNotes = cleanNotesForMessage(data.notes || null);
          if (cleanedNotes) {
            message += `📝 Obs: ${cleanedNotes}\n`;
          }
          message += `\n_CobraFácil - Edição registrada_`;
        }
        
        await sendWhatsAppNotification(phone, message);
      }
    }
    
    invalidateLoans();
    return { success: true };
  };

  const deletePayment = async (paymentId: string, loanId: string) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

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

    // 3. Delete the payment record
    // O TRIGGER do banco de dados (revert_loan_on_payment_delete) já cuida de reverter 
    // os valores automaticamente! Não precisamos fazer update manual aqui.
    const { error: deleteError } = await supabase
      .from('loan_payments')
      .delete()
      .eq('id', paymentId);

    if (deleteError) {
      toast.error('Erro ao excluir pagamento');
      return { error: deleteError };
    }

    // 4. Update client score
    await updateClientScore(loanData.client_id);

    toast.success('Pagamento excluído e saldo restaurado!');
    invalidateLoans();
    return { success: true };
  };

  // Update payment date
  const updatePaymentDate = async (paymentId: string, newDate: string) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

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
    if (!user) return { error: new Error('Usuário não autenticado') };

    // 1. Fetch current loan data
    const { data: loanData, error: fetchError } = await supabase
      .from('loans')
      .select('*, clients(full_name)')
      .eq('id', loanId)
      .single();

    if (fetchError || !loanData) {
      toast.error('Erro ao buscar dados do empréstimo');
      return { error: fetchError || new Error('Empréstimo não encontrado') };
    }

    // 2. Calculate new values
    const currentDates = (loanData.installment_dates as string[]) || [];
    const allDates = [...currentDates, ...newDates];
    const newInstallments = loanData.installments + extraCount;
    const dailyAmount = loanData.total_interest || 0;
    const extraValue = dailyAmount * extraCount;
    const newRemainingBalance = loanData.remaining_balance + extraValue;
    const newDueDate = allDates[allDates.length - 1] || loanData.due_date;

    // 3. Add tag to notes for history tracking
    const today = new Date().toISOString().split('T')[0];
    const extraTag = `[EXTRA_INSTALLMENTS:${extraCount}:${today}]`;
    const newNotes = loanData.notes 
      ? `${loanData.notes}\n${extraTag}` 
      : extraTag;

    // 4. Update the loan
    const { error: updateError } = await supabase
      .from('loans')
      .update({
        installments: newInstallments,
        installment_dates: allDates,
        remaining_balance: newRemainingBalance,
        due_date: newDueDate,
        notes: newNotes,
        status: 'pending', // Reset to pending if was overdue
      })
      .eq('id', loanId);

    if (updateError) {
      toast.error('Erro ao adicionar parcelas extras');
      return { error: updateError };
    }

    toast.success(`${extraCount} parcela(s) extra(s) adicionada(s)!`);

    // WhatsApp notifications removed - only sent via explicit user click

    invalidateLoans();
    return { success: true };
  };

  return {
    loans,
    loading,
    fetchLoans,
    createLoan,
    registerPayment,
    getLoanPayments,
    deleteLoan,
    deletePayment,
    renegotiateLoan,
    updateLoan,
    updatePaymentDate,
    addExtraInstallments,
    invalidateLoans,
  };
}
