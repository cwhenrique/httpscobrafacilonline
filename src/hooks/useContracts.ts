import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addDays, addWeeks, addMonths } from 'date-fns';

export interface Contract {
  id: string;
  user_id: string;
  client_name: string;
  client_phone: string | null;
  client_cpf: string | null;
  client_rg: string | null;
  client_email: string | null;
  client_address: string | null;
  contract_type: string;
  bill_type: 'payable' | 'receivable';
  total_amount: number;
  amount_to_receive: number;
  frequency: string;
  installments: number;
  contract_date: string | null;
  first_payment_date: string;
  payment_method: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContractPayment {
  id: string;
  contract_id: string;
  user_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContractData {
  client_name: string;
  client_phone?: string;
  client_cpf?: string;
  client_rg?: string;
  client_email?: string;
  client_address?: string;
  contract_type: string;
  bill_type: 'payable' | 'receivable';
  total_amount: number;
  amount_to_receive: number;
  frequency: string;
  installments: number;
  contract_date?: string;
  first_payment_date: string;
  payment_method?: string;
  notes?: string;
  send_creation_notification?: boolean;
}

export interface UpdateContractData {
  client_name?: string;
  client_phone?: string;
  client_cpf?: string;
  client_rg?: string;
  client_email?: string;
  client_address?: string;
  contract_type?: string;
  total_amount?: number;
  amount_to_receive?: number;
  contract_date?: string;
  notes?: string;
}

function calculateNextPaymentDate(baseDate: Date, frequency: string, index: number): Date {
  switch (frequency) {
    case 'daily':
      return addDays(baseDate, index);
    case 'weekly':
      return addWeeks(baseDate, index);
    case 'biweekly':
      return addWeeks(baseDate, index * 2);
    case 'monthly':
    default:
      return addMonths(baseDate, index);
  }
}

export function useContracts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading, error } = useQuery({
    queryKey: ['contracts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!user,
  });

  // Query para buscar todos os pagamentos de contratos do usuário
  const { data: allContractPayments = [] } = useQuery({
    queryKey: ['all_contract_payments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('contract_payments')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as ContractPayment[];
    },
    enabled: !!user,
  });

  const createContract = useMutation({
    mutationFn: async (contractData: CreateContractData) => {
      if (!user) throw new Error('User not authenticated');

      // Create the contract
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          user_id: user.id,
          ...contractData,
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Generate installment payments
      const installmentAmount = contractData.amount_to_receive / contractData.installments;
      const firstPaymentDate = new Date(contractData.first_payment_date);
      
      const payments = [];
      for (let i = 0; i < contractData.installments; i++) {
        const dueDate = calculateNextPaymentDate(firstPaymentDate, contractData.frequency, i);
        payments.push({
          contract_id: contract.id,
          user_id: user.id,
          installment_number: i + 1,
          amount: installmentAmount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending',
        });
      }

      const { error: paymentsError } = await supabase
        .from('contract_payments')
        .insert(payments);

      if (paymentsError) throw paymentsError;

      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_payments'] });
      toast.success('Contrato criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar contrato: ' + error.message);
    },
  });

  const deleteContract = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contractId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_payments'] });
      toast.success('Contrato excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir contrato: ' + error.message);
    },
  });

  const getContractPayments = async (contractId: string) => {
    const { data, error } = await supabase
      .from('contract_payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('installment_number', { ascending: true });

    if (error) throw error;
    return data as ContractPayment[];
  };

  const markPaymentAsPaid = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('contract_payments')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract_payments'] });
      toast.success('Parcela marcada como paga!');
    },
    onError: (error) => {
      toast.error('Erro ao marcar parcela: ' + error.message);
    },
  });

  const updateContract = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateContractData }) => {
      const { data: updated, error } = await supabase
        .from('contracts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contrato atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar contrato: ' + error.message);
    },
  });

  return {
    contracts,
    allContractPayments,
    isLoading,
    error,
    createContract,
    updateContract,
    deleteContract,
    getContractPayments,
    markPaymentAsPaid,
  };
}
