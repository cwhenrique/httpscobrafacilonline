import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MonthlyFee, MonthlyFeePayment, PaymentStatus } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useMonthlyFees() {
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [payments, setPayments] = useState<MonthlyFeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMonthlyFees = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('monthly_fees')
      .select(`
        *,
        client:clients(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar mensalidades');
      console.error(error);
    } else {
      setMonthlyFees(data as MonthlyFee[]);
    }
    setLoading(false);
  };

  const fetchPayments = async (monthlyFeeId?: string) => {
    if (!user) return;

    let query = supabase
      .from('monthly_fee_payments')
      .select(`
        *,
        monthly_fee:monthly_fees(*, client:clients(*))
      `)
      .order('due_date', { ascending: false });

    if (monthlyFeeId) {
      query = query.eq('monthly_fee_id', monthlyFeeId);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Erro ao carregar pagamentos');
      console.error(error);
    } else {
      setPayments(data as MonthlyFeePayment[]);
    }
  };

  const createMonthlyFee = async (fee: {
    client_id: string;
    amount: number;
    description?: string;
    due_day: number;
  }) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    const { data, error } = await supabase
      .from('monthly_fees')
      .insert({
        ...fee,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar mensalidade');
      return { error };
    }

    toast.success('Mensalidade criada com sucesso!');
    await fetchMonthlyFees();
    return { data: data as MonthlyFee };
  };

  const generateMonthlyPayment = async (monthlyFeeId: string, referenceMonth: Date) => {
    if (!user) return { error: new Error('Usuário não autenticado') };

    const fee = monthlyFees.find(f => f.id === monthlyFeeId);
    if (!fee) return { error: new Error('Mensalidade não encontrada') };

    const dueDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), fee.due_day);

    const { data, error } = await supabase
      .from('monthly_fee_payments')
      .insert({
        monthly_fee_id: monthlyFeeId,
        user_id: user.id,
        reference_month: referenceMonth.toISOString().split('T')[0],
        amount: fee.amount,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending' as PaymentStatus,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao gerar cobrança');
      return { error };
    }

    toast.success('Cobrança gerada com sucesso!');
    await fetchPayments();
    return { data: data as MonthlyFeePayment };
  };

  const registerPayment = async (paymentId: string, paymentDate: string) => {
    const { error } = await supabase
      .from('monthly_fee_payments')
      .update({
        status: 'paid' as PaymentStatus,
        payment_date: paymentDate,
      })
      .eq('id', paymentId);

    if (error) {
      toast.error('Erro ao registrar pagamento');
      return { error };
    }

    toast.success('Pagamento registrado com sucesso!');
    await fetchPayments();
    return { success: true };
  };

  const deleteMonthlyFee = async (id: string) => {
    const { error } = await supabase
      .from('monthly_fees')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir mensalidade');
      return { error };
    }

    toast.success('Mensalidade excluída com sucesso!');
    await fetchMonthlyFees();
    return { success: true };
  };

  useEffect(() => {
    fetchMonthlyFees();
    fetchPayments();
  }, [user]);

  return {
    monthlyFees,
    payments,
    loading,
    fetchMonthlyFees,
    fetchPayments,
    createMonthlyFee,
    generateMonthlyPayment,
    registerPayment,
    deleteMonthlyFee,
  };
}
