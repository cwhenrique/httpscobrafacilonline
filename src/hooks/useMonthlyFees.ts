import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { addMonths, setDate, format } from 'date-fns';

export interface MonthlyFee {
  id: string;
  user_id: string;
  client_id: string;
  amount: number;
  description: string | null;
  due_day: number;
  is_active: boolean;
  interest_rate: number | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    full_name: string;
    phone: string | null;
  };
}

export interface MonthlyFeePayment {
  id: string;
  monthly_fee_id: string;
  user_id: string;
  reference_month: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMonthlyFeeData {
  client_id: string;
  amount: number;
  description?: string;
  due_day: number;
  interest_rate?: number;
  generate_current_month?: boolean;
}

export interface UpdateMonthlyFeeData {
  amount?: number;
  description?: string;
  due_day?: number;
  interest_rate?: number;
  is_active?: boolean;
}

export function useMonthlyFees() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { effectiveUserId } = useEmployeeContext();

  const userId = effectiveUserId || user?.id;

  // Fetch all monthly fees with client data
  const { data: fees = [], isLoading } = useQuery({
    queryKey: ['monthly-fees', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('monthly_fees')
        .select(`
          *,
          client:clients(id, full_name, phone)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MonthlyFee[];
    },
    enabled: !!userId,
  });

  // Create monthly fee
  const createFee = useMutation({
    mutationFn: async (data: CreateMonthlyFeeData) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const { data: newFee, error } = await supabase
        .from('monthly_fees')
        .insert({
          user_id: userId,
          client_id: data.client_id,
          amount: data.amount,
          description: data.description || null,
          due_day: data.due_day,
          interest_rate: data.interest_rate || 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Generate current month payment if requested
      if (data.generate_current_month) {
        const now = new Date();
        const currentMonth = format(now, 'yyyy-MM-01');
        let dueDate = setDate(now, data.due_day);
        if (dueDate < now) {
          dueDate = setDate(addMonths(now, 1), data.due_day);
        }

        await supabase.from('monthly_fee_payments').insert({
          user_id: userId,
          monthly_fee_id: newFee.id,
          reference_month: currentMonth,
          amount: data.amount,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          status: 'pending',
        });
      }

      return newFee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fees'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-fee-payments'] });
      toast.success('Assinatura criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating monthly fee:', error);
      toast.error('Erro ao criar assinatura');
    },
  });

  // Update monthly fee
  const updateFee = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMonthlyFeeData }) => {
      const { error } = await supabase
        .from('monthly_fees')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fees'] });
      toast.success('Assinatura atualizada!');
    },
    onError: (error: Error) => {
      console.error('Error updating monthly fee:', error);
      toast.error('Erro ao atualizar assinatura');
    },
  });

  // Delete monthly fee
  const deleteFee = useMutation({
    mutationFn: async (id: string) => {
      // First delete all payments
      await supabase
        .from('monthly_fee_payments')
        .delete()
        .eq('monthly_fee_id', id);

      const { error } = await supabase
        .from('monthly_fees')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fees'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-fee-payments'] });
      toast.success('Assinatura excluída!');
    },
    onError: (error: Error) => {
      console.error('Error deleting monthly fee:', error);
      toast.error('Erro ao excluir assinatura');
    },
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('monthly_fees')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fees'] });
      toast.success(variables.is_active ? 'Assinatura ativada!' : 'Assinatura desativada!');
    },
    onError: (error: Error) => {
      console.error('Error toggling monthly fee:', error);
      toast.error('Erro ao alterar status');
    },
  });

  // Generate monthly payment
  const generatePayment = useMutation({
    mutationFn: async ({ feeId, referenceMonth }: { feeId: string; referenceMonth: string }) => {
      if (!userId) throw new Error('Usuário não autenticado');

      const fee = fees.find(f => f.id === feeId);
      if (!fee) throw new Error('Assinatura não encontrada');

      // Check if payment already exists
      const { data: existing } = await supabase
        .from('monthly_fee_payments')
        .select('id')
        .eq('monthly_fee_id', feeId)
        .eq('reference_month', referenceMonth)
        .maybeSingle();

      if (existing) {
        throw new Error('Cobrança já existe para este mês');
      }

      const refDate = new Date(referenceMonth);
      const dueDate = setDate(refDate, fee.due_day);

      const { data, error } = await supabase
        .from('monthly_fee_payments')
        .insert({
          user_id: userId,
          monthly_fee_id: feeId,
          reference_month: referenceMonth,
          amount: fee.amount,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fee-payments'] });
      toast.success('Cobrança gerada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error generating payment:', error);
      toast.error(error.message || 'Erro ao gerar cobrança');
    },
  });

  return {
    fees,
    isLoading,
    createFee,
    updateFee,
    deleteFee,
    toggleActive,
    generatePayment,
  };
}

export function useMonthlyFeePayments(feeId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { effectiveUserId } = useEmployeeContext();

  const userId = effectiveUserId || user?.id;

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['monthly-fee-payments', userId, feeId],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('monthly_fee_payments')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: false });

      if (feeId) {
        query = query.eq('monthly_fee_id', feeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MonthlyFeePayment[];
    },
    enabled: !!userId,
  });

  // Mark as paid and auto-generate next month
  const markAsPaid = useMutation({
    mutationFn: async ({ paymentId, paidDate, paidAmount }: { paymentId: string; paidDate: string; paidAmount?: number }) => {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Pagamento não encontrado');

      const updateData: Partial<MonthlyFeePayment> = {
        status: 'paid',
        payment_date: paidDate,
      };

      if (paidAmount !== undefined) {
        updateData.amount = paidAmount;
      }

      const { error } = await supabase
        .from('monthly_fee_payments')
        .update(updateData)
        .eq('id', paymentId);

      if (error) throw error;

      // Auto-generate next month payment
      const currentRefMonth = new Date(payment.reference_month);
      const nextMonth = addMonths(currentRefMonth, 1);
      const nextReferenceMonth = format(nextMonth, 'yyyy-MM-01');

      // Check if payment for next month already exists
      const { data: existingNext } = await supabase
        .from('monthly_fee_payments')
        .select('id')
        .eq('monthly_fee_id', payment.monthly_fee_id)
        .eq('reference_month', nextReferenceMonth)
        .maybeSingle();

      if (!existingNext) {
        // Get fee info for due_day and amount
        const { data: fee } = await supabase
          .from('monthly_fees')
          .select('due_day, amount, is_active')
          .eq('id', payment.monthly_fee_id)
          .single();

        // Only generate if subscription is active
        if (fee?.is_active) {
          const nextDueDate = setDate(nextMonth, fee.due_day);
          
          await supabase.from('monthly_fee_payments').insert({
            user_id: payment.user_id,
            monthly_fee_id: payment.monthly_fee_id,
            reference_month: nextReferenceMonth,
            amount: fee.amount,
            due_date: format(nextDueDate, 'yyyy-MM-dd'),
            status: 'pending',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fee-payments'] });
      toast.success('Pagamento registrado! Próximo mês gerado.');
    },
    onError: (error: Error) => {
      console.error('Error marking payment as paid:', error);
      toast.error('Erro ao registrar pagamento');
    },
  });

  // Delete payment
  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('monthly_fee_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fee-payments'] });
      toast.success('Cobrança removida!');
    },
    onError: (error: Error) => {
      console.error('Error deleting payment:', error);
      toast.error('Erro ao remover cobrança');
    },
  });

  // Calculate amount with interest
  const calculateWithInterest = (payment: MonthlyFeePayment, interestRate: number) => {
    const today = new Date();
    const dueDate = new Date(payment.due_date);
    
    if (payment.status === 'paid' || dueDate >= today) {
      return payment.amount;
    }

    const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLate <= 0) return payment.amount;

    // Daily interest rate
    const dailyRate = (interestRate || 0) / 30;
    const interest = payment.amount * (dailyRate / 100) * daysLate;
    
    return payment.amount + interest;
  };

  // Update payment (due date, amount)
  const updatePayment = useMutation({
    mutationFn: async ({ 
      paymentId, 
      data 
    }: { 
      paymentId: string; 
      data: { due_date?: string; amount?: number } 
    }) => {
      const { error } = await supabase
        .from('monthly_fee_payments')
        .update(data)
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-fee-payments'] });
      toast.success('Pagamento atualizado!');
    },
    onError: (error: Error) => {
      console.error('Error updating payment:', error);
      toast.error('Erro ao atualizar pagamento');
    },
  });

  return {
    payments,
    isLoading,
    markAsPaid,
    deletePayment,
    updatePayment,
    calculateWithInterest,
  };
}
