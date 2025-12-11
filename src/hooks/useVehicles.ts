import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';

export interface Vehicle {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  plate: string | null;
  chassis: string | null;
  seller_name: string;
  buyer_name: string | null;
  purchase_date: string;
  purchase_value: number;
  down_payment: number;
  installments: number;
  installment_value: number;
  first_due_date: string;
  total_paid: number;
  remaining_balance: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehiclePayment {
  id: string;
  user_id: string;
  vehicle_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVehicleData {
  brand: string;
  model: string;
  year: number;
  color?: string;
  plate?: string;
  chassis?: string;
  seller_name: string;
  buyer_name?: string;
  purchase_date: string;
  purchase_value: number;
  down_payment?: number;
  installments: number;
  installment_value: number;
  first_due_date: string;
  notes?: string;
}

export interface UpdateVehicleData {
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  plate?: string;
  chassis?: string;
  seller_name?: string;
  buyer_name?: string;
  purchase_date?: string;
  purchase_value?: number;
  down_payment?: number;
  installments?: number;
  installment_value?: number;
  first_due_date?: string;
  notes?: string;
  status?: string;
}

export function useVehicles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading, error } = useQuery({
    queryKey: ['vehicles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: !!user?.id,
  });

  const createVehicle = useMutation({
    mutationFn: async (data: CreateVehicleData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const downPayment = data.down_payment || 0;
      const remainingBalance = data.purchase_value - downPayment;

      // Create vehicle
      const { data: newVehicle, error } = await supabase
        .from('vehicles')
        .insert({
          user_id: user.id,
          brand: data.brand,
          model: data.model,
          year: data.year,
          color: data.color || null,
          plate: data.plate || null,
          chassis: data.chassis || null,
          seller_name: data.seller_name,
          buyer_name: data.buyer_name || null,
          purchase_date: data.purchase_date,
          purchase_value: data.purchase_value,
          down_payment: downPayment,
          installments: data.installments,
          installment_value: data.installment_value,
          first_due_date: data.first_due_date,
          total_paid: downPayment,
          remaining_balance: remainingBalance,
          notes: data.notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Generate installment payments
      const payments = [];
      for (let i = 0; i < data.installments; i++) {
        const dueDate = addMonths(new Date(data.first_due_date), i);
        payments.push({
          user_id: user.id,
          vehicle_id: newVehicle.id,
          installment_number: i + 1,
          amount: data.installment_value,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          status: 'pending',
        });
      }

      const { error: paymentsError } = await supabase
        .from('vehicle_payments')
        .insert(payments);

      if (paymentsError) throw paymentsError;

      return newVehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle_payments'] });
      toast.success('Veículo cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar veículo: ' + error.message);
    },
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateVehicleData }) => {
      const { data: updated, error } = await supabase
        .from('vehicles')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Veículo atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar veículo: ' + error.message);
    },
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle_payments'] });
      toast.success('Veículo excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir veículo: ' + error.message);
    },
  });

  return {
    vehicles,
    isLoading,
    error,
    createVehicle,
    updateVehicle,
    deleteVehicle,
  };
}

export function useVehiclePayments(vehicleId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['vehicle_payments', vehicleId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('vehicle_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as VehiclePayment[];
    },
    enabled: !!user?.id,
  });

  const markAsPaid = useMutation({
    mutationFn: async ({ paymentId, vehicleId }: { paymentId: string; vehicleId: string }) => {
      // Update payment
      const { data: payment, error: paymentError } = await supabase
        .from('vehicle_payments')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update vehicle totals
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (vehicleError) throw vehicleError;

      const newTotalPaid = (vehicle.total_paid || 0) + payment.amount;
      const newRemainingBalance = vehicle.purchase_value - newTotalPaid;

      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          total_paid: newTotalPaid,
          remaining_balance: newRemainingBalance,
          status: newRemainingBalance <= 0 ? 'paid' : 'pending',
        })
        .eq('id', vehicleId);

      if (updateError) throw updateError;

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle_payments'] });
      toast.success('Parcela marcada como paga!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao marcar parcela: ' + error.message);
    },
  });

  return {
    payments,
    isLoading,
    error,
    markAsPaid,
  };
}
