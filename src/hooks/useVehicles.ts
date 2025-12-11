import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

const sendWhatsAppNotification = async (phone: string, message: string) => {
  try {
    const { error } = await supabase.functions.invoke('send-whatsapp', {
      body: { phone, message },
    });
    if (error) {
      console.error('WhatsApp notification error:', error);
    }
  } catch (err) {
    console.error('Failed to send WhatsApp:', err);
  }
};

const getUserPhone = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .single();
  return data?.phone || null;
};

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
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_cpf: string | null;
  buyer_rg: string | null;
  buyer_address: string | null;
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
  vehicle?: Vehicle;
}

export interface InstallmentDate {
  installment_number: number;
  due_date: string;
  amount: number;
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
  buyer_phone?: string;
  buyer_email?: string;
  buyer_cpf?: string;
  buyer_rg?: string;
  buyer_address?: string;
  purchase_date: string;
  purchase_value: number;
  down_payment?: number;
  installments: number;
  installment_value: number;
  first_due_date: string;
  notes?: string;
  custom_installments?: InstallmentDate[];
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
  buyer_phone?: string;
  buyer_email?: string;
  buyer_cpf?: string;
  buyer_rg?: string;
  buyer_address?: string;
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
          buyer_phone: data.buyer_phone || null,
          buyer_email: data.buyer_email || null,
          purchase_date: data.purchase_date || new Date().toISOString().split('T')[0],
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

      // Generate installment payments - use custom dates if provided
      const payments = [];
      const installmentsList: string[] = [];
      
      if (data.custom_installments && data.custom_installments.length > 0) {
        for (const inst of data.custom_installments) {
          payments.push({
            user_id: user.id,
            vehicle_id: newVehicle.id,
            installment_number: inst.installment_number,
            amount: inst.amount,
            due_date: inst.due_date,
            status: 'pending',
          });
          installmentsList.push(`${inst.installment_number}ª: ${formatDate(inst.due_date)} - ${formatCurrency(inst.amount)}`);
        }
      } else {
        for (let i = 0; i < data.installments; i++) {
          const dueDate = addMonths(new Date(data.first_due_date), i);
          const dueDateStr = format(dueDate, 'yyyy-MM-dd');
          payments.push({
            user_id: user.id,
            vehicle_id: newVehicle.id,
            installment_number: i + 1,
            amount: data.installment_value,
            due_date: dueDateStr,
            status: 'pending',
          });
          installmentsList.push(`${i + 1}ª: ${formatDate(dueDateStr)} - ${formatCurrency(data.installment_value)}`);
        }
      }

      const { error: paymentsError } = await supabase
        .from('vehicle_payments')
        .insert(payments);

      if (paymentsError) throw paymentsError;

      // Send WhatsApp notification
      const userPhone = await getUserPhone(user.id);
      if (userPhone) {
        const vehicleName = `${data.brand} ${data.model} ${data.year}`;
        const clientName = data.buyer_name || data.seller_name;
        
        const message = `🚗 *Novo Veículo Registrado*\n\n` +
          `📋 *Veículo:* ${vehicleName}\n` +
          `${data.plate ? `🔖 *Placa:* ${data.plate}\n` : ''}` +
          `👤 *Cliente:* ${clientName}\n` +
          `💰 *Valor Total:* ${formatCurrency(data.purchase_value)}\n` +
          `${downPayment > 0 ? `💵 *Entrada:* ${formatCurrency(downPayment)}\n` : ''}` +
          `📊 *Parcelas:* ${data.installments}x de ${formatCurrency(data.installment_value)}\n\n` +
          `📅 *Datas das Parcelas:*\n${installmentsList.join('\n')}\n\n` +
          `_CobraFácil - Registro automático_`;

        await sendWhatsAppNotification(userPhone, message);
      }

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
        .select('*, vehicle:vehicles(*)')
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

      // Send WhatsApp notification
      const userPhone = await getUserPhone(vehicle.user_id);
      if (userPhone) {
        const vehicleName = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
        const clientName = vehicle.buyer_name || vehicle.seller_name;
        const today = new Date().toISOString().split('T')[0];
        
        const message = `💵 *Pagamento de Veículo Recebido*\n\n` +
          `🚗 *Veículo:* ${vehicleName}\n` +
          `${vehicle.plate ? `🔖 *Placa:* ${vehicle.plate}\n` : ''}` +
          `👤 *Cliente:* ${clientName}\n` +
          `💰 *Valor:* ${formatCurrency(payment.amount)}\n` +
          `📅 *Parcela:* ${payment.installment_number}ª\n` +
          `📅 *Data:* ${formatDate(today)}\n\n` +
          `📊 *Situação atual:*\n` +
          `• Recebido: ${formatCurrency(newTotalPaid)}\n` +
          `• Falta: ${formatCurrency(newRemainingBalance)}\n\n` +
          `_CobraFácil - Confirmação automática_`;

        await sendWhatsAppNotification(userPhone, message);
      }

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
