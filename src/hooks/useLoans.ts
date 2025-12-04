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
    start_date: string;
    due_date: string;
    notes?: string;
    installment_dates?: string[];
    remaining_balance?: number;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('loans')
      .insert({
        ...loan,
        user_id: user.id,
        remaining_balance: loan.remaining_balance ?? loan.principal_amount,
        total_interest: 0,
        total_paid: 0,
        installment_dates: loan.installment_dates || [],
      })
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
    
    // Send WhatsApp notification for new loan
    const phone = await getUserPhone(user.id);
    if (phone && data) {
      const clientName = (data.client as any)?.full_name || 'Cliente';
      const numInstallments = loan.installments || 1;
      const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      
      let message = `✅ *Novo Empréstimo Registrado*\n\n`;
      message += `👤 Cliente: *${clientName}*\n`;
      message += `💰 Valor: *${formatCurrency(loan.principal_amount)}*\n`;
      
      if (loan.payment_type === 'daily') {
        // Daily payment loan - no interest shown
        const dailyAmount = loan.principal_amount / numInstallments;
        message += `📆 Tipo: *Pagamento Diário*\n`;
        message += `💵 Valor diário: *${formatCurrency(dailyAmount)}*\n`;
        message += `📅 Dias de cobrança: *${numInstallments} dias*\n\n`;
        
        if (loan.installment_dates && loan.installment_dates.length > 0) {
          message += `*Datas selecionadas:*\n`;
          loan.installment_dates.forEach((date, index) => {
            message += `• Dia ${index + 1}: ${formatDate(date)}\n`;
          });
        }
      } else if (loan.payment_type === 'installment' && numInstallments > 1) {
        message += `📊 Juros: *${loan.interest_rate}% por parcela*\n`;
        message += `📅 Parcelas: *${numInstallments}x de ${formatCurrency(totalPerInstallment)}*\n`;
        if (loan.installment_dates && loan.installment_dates.length > 0) {
          message += `⏰ 1ª Parcela: *${formatDate(loan.installment_dates[0])}*\n`;
        }
      } else {
        message += `📊 Juros: *${loan.interest_rate}% por parcela*\n`;
        message += `📅 Vencimento: *${formatDate(loan.due_date)}*\n`;
        message += `💵 Total a receber: *${formatCurrency(loan.principal_amount + interestPerInstallment)}*\n`;
      }
      
      message += `\n_CobraFácil - Registro automático_`;
      
      await sendWhatsAppNotification(phone, message);
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
      .select('client_id, remaining_balance, principal_amount, interest_rate, installments, total_paid, clients(full_name)')
      .eq('id', payment.loan_id)
      .single();
    
    if (loan) {
      await updateClientScore(loan.client_id);
      
      const clientName = (loan.clients as any)?.full_name || 'Cliente';
      
      // Calcular igual ao card: total a receber = principal + juros totais
      const numInstallments = loan.installments || 1;
      const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
      const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
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
      
      // Send WhatsApp notification for payment received
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
          message += `• Pago: ${formatCurrency(newTotalPaid)}\n`;
          message += `• Restante: ${formatCurrency(remainingToReceive > 0 ? remainingToReceive : 0)}\n\n`;
          message += `_CobraFácil - Confirmação automática_`;
        }
        
        await sendWhatsAppNotification(phone, message);
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
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    // Get loan info before update for notification
    const { data: loanData } = await supabase
      .from('loans')
      .select('principal_amount, total_paid, clients(full_name)')
      .eq('id', id)
      .single();

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
    
    // Send WhatsApp notification for renegotiation
    if (loanData) {
      const clientName = (loanData.clients as any)?.full_name || 'Cliente';
      const numInstallments = data.installments || 1;
      const interestPerInstallment = loanData.principal_amount * (data.interest_rate / 100);
      const totalToReceive = loanData.principal_amount + (interestPerInstallment * numInstallments);
      const totalPaid = loanData.total_paid || 0;
      const remainingToReceive = totalToReceive - totalPaid;
      
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
        if (data.notes) {
          message += `📝 Obs: ${data.notes}\n`;
        }
        message += `\n_CobraFácil - Renegociação registrada_`;
        
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
  };
}
