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
    
    // Send WhatsApp notification for new loan - only if enabled (default: true)
    if (loan.send_creation_notification !== false) {
      const phone = await getUserPhone(user.id);
      if (phone && data) {
      const clientName = (data.client as any)?.full_name || 'Cliente';
      const numInstallments = loan.installments || 1;
      
      // Calculate total interest based on interest_mode
      let totalInterest = 0;
      if (loan.interest_mode === 'on_total') {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100);
      } else {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      }
      
      const interestPerInstallment = totalInterest / numInstallments;
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      
      const contractId = `EMP-${data?.id?.substring(0, 4).toUpperCase() || '0000'}`;
      const totalToReceive = loan.principal_amount + totalInterest;
      const progressPercent = 0;
      
      let modalidade = 'Padrão';
      if (loan.payment_type === 'daily') modalidade = 'Diário';
      else if (loan.payment_type === 'weekly') modalidade = 'Semanal';
      else if (loan.payment_type === 'installment') modalidade = 'Parcelado';
      else if (loan.payment_type === 'single') modalidade = 'Único';
      
      let message = `🏦 *Resumo do Empréstimo - ${contractId}*\n\n`;
      message += `👤 Cliente: ${clientName}\n\n`;
      message += `💰 *Informações do Empréstimo:*\n`;
      message += `- Valor Emprestado: ${formatCurrency(loan.principal_amount)}\n`;
      message += `- Valor Total: ${formatCurrency(totalToReceive)}\n`;
      message += `- Taxa de Juros: ${loan.interest_rate}%\n`;
      message += `- Data Início: ${formatDate(loan.start_date)}\n`;
      message += `- Modalidade: ${modalidade}\n\n`;
      
      if (loan.payment_type === 'daily') {
        const dailyAmount = loan.total_interest || (loan.principal_amount / numInstallments);
        const totalToReceiveDaily = dailyAmount * numInstallments;
        const profit = totalToReceiveDaily - loan.principal_amount;
        message += `📊 *Detalhes Diário:*\n`;
        message += `- Valor diário: ${formatCurrency(dailyAmount)}\n`;
        message += `- Dias: ${numInstallments}\n`;
        message += `- Lucro: ${formatCurrency(profit)}\n\n`;
      }
      
      message += `📊 *Status das Parcelas:*\n`;
      message += `✅ Pagas: 0 de ${numInstallments} parcelas (${formatCurrency(0)})\n`;
      message += `⏰ Pendentes: ${numInstallments} parcelas (${formatCurrency(totalToReceive)})\n`;
      message += `📈 Progresso: 0% concluído\n\n`;
      
      message += `📅 *Próxima Parcela:*\n`;
      message += `- Vencimento: ${formatDate(loan.installment_dates?.[0] || loan.due_date)}\n`;
      message += `- Valor: ${formatCurrency(totalPerInstallment)}\n\n`;
      
      message += `💰 Saldo Devedor: ${formatCurrency(totalToReceive)}\n\n`;
      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `_CobraFácil - Registro automático_`;
      
      await sendWhatsAppNotification(phone, message);
      }
    }
    
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
      
      // Calcular igual ao card: total a receber = principal + juros totais
      const numInstallments = loan.installments || 1;
      
      // Calculate total interest based on interest_mode
      let totalInterest = 0;
      if (loan.interest_mode === 'on_total') {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100);
      } else {
        totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
      }
      
      const totalToReceive = loan.principal_amount + totalInterest;
      const newTotalPaid = loan.total_paid || 0;
      const remainingToReceive = totalToReceive - newTotalPaid;
      const isPaidOff = remainingToReceive <= 0;
      
      // Create notification for payment received
      await createNotificationRecord(user.id, {
        title: isPaidOff ? '✅ Empréstimo Quitado!' : '💰 Pagamento Recebido',
        message: isPaidOff 
          ? `${clientName} quitou o empréstimo de ${formatCurrency(payment.amount)}`
          : `${clientName} realizou um pagamento de ${formatCurrency(payment.amount)}`,
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
    remaining_balance?: number;
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
    
    await fetchLoans();
    return { success: true };
  };

  const updateLoan = async (id: string, data: {
    client_id: string;
    principal_amount: number;
    interest_rate: number;
    interest_type: InterestType;
    interest_mode?: 'per_installment' | 'on_total';
    payment_type: LoanPaymentType;
    installments?: number;
    contract_date?: string;
    start_date: string;
    due_date: string;
    notes?: string;
    installment_dates?: string[];
    remaining_balance?: number;
    total_interest?: number;
    send_notification?: boolean;
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
      } else {
        totalInterest = data.principal_amount * (data.interest_rate / 100) * numInstallments;
      }
      
      const totalToReceive = data.principal_amount + totalInterest;
      const totalPaid = newLoanData.total_paid || 0;
      const remainingToReceive = totalToReceive - totalPaid;
      
      const phone = await getUserPhone(user.id);
      if (phone) {
        let message = `✏️ *Empréstimo Editado*\n\n`;
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
        
        await sendWhatsAppNotification(phone, message);
      }
    }
    
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
    updateLoan,
  };
}
