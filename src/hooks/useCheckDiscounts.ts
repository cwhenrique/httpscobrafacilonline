import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { toast } from 'sonner';
import { 
  CheckDiscount, 
  CheckDiscountPayment, 
  CheckDiscountFormData, 
  CheckDiscountStats,
  CheckDiscountStatus,
  calculateDiscountAmount,
  calculateNetValue,
  getDaysUntilDue
} from '@/types/checkDiscount';
import { differenceInDays } from 'date-fns';

export type CheckDiscountFilterType = 'all' | 'open' | 'paid' | 'overdue' | CheckDiscountStatus;

export function useCheckDiscounts() {
  const { effectiveUserId, isEmployee } = useEmployeeContext();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<CheckDiscountFilterType>('open');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all check discounts
  const { data: checkDiscounts = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['check-discounts', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      
      const { data, error } = await supabase
        .from('check_discounts')
        .select(`
          *,
          clients (
            id,
            full_name,
            phone,
            score
          )
        `)
        .eq('user_id', effectiveUserId)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching check discounts:', error);
        throw error;
      }

      return data as CheckDiscount[];
    },
    enabled: !!effectiveUserId,
  });

  // Calculate statistics
  const stats: CheckDiscountStats = useMemo(() => {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const inWallet = checkDiscounts.filter(c => c.status === 'in_wallet');
    const compensated = checkDiscounts.filter(c => c.status === 'compensated');
    const returned = checkDiscounts.filter(c => c.status === 'returned');
    const inCollection = checkDiscounts.filter(c => c.status === 'in_collection');
    
    const dueSoon = inWallet.filter(c => {
      const dueDate = new Date(c.due_date);
      return dueDate <= sevenDaysFromNow && dueDate >= today;
    });

    return {
      inWalletCount: inWallet.length,
      inWalletValue: inWallet.reduce((sum, c) => sum + c.nominal_value, 0),
      dueSoonCount: dueSoon.length,
      compensatedCount: compensated.length,
      compensatedValue: compensated.reduce((sum, c) => sum + c.nominal_value, 0),
      returnedCount: returned.length,
      returnedValue: returned.reduce((sum, c) => sum + c.nominal_value, 0),
      inCollectionCount: inCollection.length,
      expectedProfit: inWallet.reduce((sum, c) => sum + c.discount_amount, 0),
      realizedProfit: compensated.reduce((sum, c) => sum + c.discount_amount, 0),
    };
  }, [checkDiscounts]);

  // Helper to check if a check is overdue
  const isCheckOverdue = useCallback((check: CheckDiscount) => {
    if (check.status !== 'in_wallet') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(check.due_date + 'T12:00:00');
    return dueDate < today;
  }, []);

  // Filter counts for UI badges
  const filterCounts = useMemo(() => {
    const all = checkDiscounts.length;
    const open = checkDiscounts.filter(c => c.status === 'in_wallet').length;
    const paid = checkDiscounts.filter(c => c.status === 'compensated').length;
    const overdue = checkDiscounts.filter(c => isCheckOverdue(c)).length;
    const inCollection = checkDiscounts.filter(c => c.status === 'in_collection').length;
    const returned = checkDiscounts.filter(c => c.status === 'returned').length;
    
    return { all, open, paid, overdue, inCollection, returned };
  }, [checkDiscounts, isCheckOverdue]);

  // Filtered checks
  const filteredChecks = useMemo(() => {
    let filtered = checkDiscounts;

    // Apply status filter
    switch (statusFilter) {
      case 'all':
        // No filter
        break;
      case 'open':
        filtered = filtered.filter(c => c.status === 'in_wallet');
        break;
      case 'paid':
        filtered = filtered.filter(c => c.status === 'compensated');
        break;
      case 'overdue':
        filtered = filtered.filter(c => isCheckOverdue(c));
        break;
      case 'in_wallet':
      case 'compensated':
      case 'returned':
      case 'in_collection':
        filtered = filtered.filter(c => c.status === statusFilter);
        break;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.check_number.toLowerCase().includes(term) ||
        c.bank_name.toLowerCase().includes(term) ||
        c.issuer_name?.toLowerCase().includes(term) ||
        c.issuer_document?.includes(term) ||
        c.clients?.full_name.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [checkDiscounts, statusFilter, searchTerm, isCheckOverdue]);

  // Create check discount
  const createMutation = useMutation({
    mutationFn: async (formData: CheckDiscountFormData) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');

      let discountAmount: number;
      let netValue: number;
      let purchaseValue: number;

      // Check if user provided purchase_value directly (direct mode)
      if (formData.purchase_value && formData.purchase_value > 0) {
        // Direct mode: use provided purchase value
        purchaseValue = formData.purchase_value;
        discountAmount = formData.nominal_value - purchaseValue;
        netValue = purchaseValue;
      } else {
        // Calculated mode: use rate formula
        const daysUntilDue = getDaysUntilDue(formData.discount_date, formData.due_date);
        discountAmount = calculateDiscountAmount(
          formData.nominal_value,
          formData.discount_rate,
          formData.discount_type,
          daysUntilDue
        );
        netValue = calculateNetValue(formData.nominal_value, discountAmount);
        purchaseValue = netValue;
      }

      const { data, error } = await supabase
        .from('check_discounts')
        .insert({
          user_id: effectiveUserId,
          client_id: formData.client_id || null,
          bank_name: formData.bank_name,
          check_number: formData.check_number,
          issuer_document: formData.issuer_document || null,
          issuer_name: formData.issuer_name || null,
          nominal_value: formData.nominal_value,
          due_date: formData.due_date,
          discount_date: formData.discount_date,
          discount_type: formData.discount_type,
          discount_rate: formData.discount_rate,
          discount_amount: discountAmount,
          net_value: netValue,
          payment_method: formData.payment_method,
          notes: formData.notes || null,
          purchase_value: purchaseValue,
          seller_name: formData.seller_name || null,
          status: 'in_wallet',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-discounts'] });
      toast.success('Cheque cadastrado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating check discount:', error);
      toast.error('Erro ao cadastrar cheque');
    },
  });

  // Update check discount
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<CheckDiscountFormData> & { id: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');

      const updateData: Record<string, unknown> = { ...formData };
      
      // Recalculate if values changed
      if (formData.nominal_value && formData.discount_rate && formData.discount_type && formData.due_date && formData.discount_date) {
        const daysUntilDue = getDaysUntilDue(formData.discount_date, formData.due_date);
        updateData.discount_amount = calculateDiscountAmount(
          formData.nominal_value,
          formData.discount_rate,
          formData.discount_type,
          daysUntilDue
        );
        updateData.net_value = calculateNetValue(formData.nominal_value, updateData.discount_amount as number);
      }

      const { data, error } = await supabase
        .from('check_discounts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-discounts'] });
      toast.success('Cheque atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating check discount:', error);
      toast.error('Erro ao atualizar cheque');
    },
  });

  // Compensate check
  const compensateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('check_discounts')
        .update({ status: 'compensated' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-discounts'] });
      toast.success('Cheque compensado com sucesso!');
    },
    onError: (error) => {
      console.error('Error compensating check:', error);
      toast.error('Erro ao compensar cheque');
    },
  });

  // Return check (devolution)
  const returnCheckMutation = useMutation({
    mutationFn: async ({ 
      id, 
      return_date, 
      return_reason, 
      penalty_amount, 
      penalty_rate,
      total_debt,
      installments_count 
    }: { 
      id: string; 
      return_date: string; 
      return_reason: string;
      penalty_amount: number;
      penalty_rate: number;
      total_debt: number;
      installments_count: number;
    }) => {
      const { data, error } = await supabase
        .from('check_discounts')
        .update({ 
          status: installments_count > 1 ? 'in_collection' : 'returned',
          return_date,
          return_reason,
          penalty_amount,
          penalty_rate,
          total_debt,
          total_paid_debt: 0,
          installments_count,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-discounts'] });
      toast.success('Devolução registrada com sucesso!');
    },
    onError: (error) => {
      console.error('Error returning check:', error);
      toast.error('Erro ao registrar devolução');
    },
  });

  // Register debt payment
  const registerDebtPaymentMutation = useMutation({
    mutationFn: async ({ 
      checkId, 
      amount, 
      installmentNumber,
      notes 
    }: { 
      checkId: string; 
      amount: number;
      installmentNumber: number;
      notes?: string;
    }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');

      // Insert payment
      const { error: paymentError } = await supabase
        .from('check_discount_payments')
        .insert({
          check_discount_id: checkId,
          user_id: effectiveUserId,
          amount,
          installment_number: installmentNumber,
          notes: notes || null,
        });

      if (paymentError) throw paymentError;

      // Get current check to update total_paid_debt
      const { data: check, error: fetchError } = await supabase
        .from('check_discounts')
        .select('total_debt, total_paid_debt')
        .eq('id', checkId)
        .single();

      if (fetchError) throw fetchError;

      const newTotalPaid = (check.total_paid_debt || 0) + amount;
      const isPaidOff = newTotalPaid >= (check.total_debt || 0);

      // Update check
      const { data, error: updateError } = await supabase
        .from('check_discounts')
        .update({ 
          total_paid_debt: newTotalPaid,
          status: isPaidOff ? 'compensated' : 'in_collection',
        })
        .eq('id', checkId)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-discounts'] });
      toast.success('Pagamento registrado com sucesso!');
    },
    onError: (error) => {
      console.error('Error registering debt payment:', error);
      toast.error('Erro ao registrar pagamento');
    },
  });

  // Delete check
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('check_discounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-discounts'] });
      toast.success('Cheque excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting check discount:', error);
      toast.error('Erro ao excluir cheque');
    },
  });

  // Fetch payments for a specific check
  const fetchPayments = useCallback(async (checkId: string): Promise<CheckDiscountPayment[]> => {
    const { data, error } = await supabase
      .from('check_discount_payments')
      .select('*')
      .eq('check_discount_id', checkId)
      .order('installment_number', { ascending: true });

    if (error) {
      console.error('Error fetching payments:', error);
      return [];
    }

    return data;
  }, []);

  // Get client check history (for risk analysis)
  const getClientCheckHistory = useCallback((clientId: string) => {
    const clientChecks = checkDiscounts.filter(c => c.client_id === clientId);
    const total = clientChecks.length;
    const returned = clientChecks.filter(c => c.status === 'returned' || c.status === 'in_collection').length;
    const returnRate = total > 0 ? (returned / total) * 100 : 0;
    
    return {
      total,
      returned,
      compensated: clientChecks.filter(c => c.status === 'compensated').length,
      inWallet: clientChecks.filter(c => c.status === 'in_wallet').length,
      returnRate,
      isHighRisk: returnRate > 30,
    };
  }, [checkDiscounts]);

  return {
    checkDiscounts,
    filteredChecks,
    loading,
    stats,
    filterCounts,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    refetch,
    createCheck: createMutation.mutateAsync,
    updateCheck: updateMutation.mutateAsync,
    compensateCheck: compensateMutation.mutateAsync,
    returnCheck: returnCheckMutation.mutateAsync,
    registerDebtPayment: registerDebtPaymentMutation.mutateAsync,
    deleteCheck: deleteMutation.mutateAsync,
    fetchPayments,
    getClientCheckHistory,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
