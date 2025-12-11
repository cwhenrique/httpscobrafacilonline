import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addMonths, format } from 'date-fns';

export interface ProductSale {
  id: string;
  user_id: string;
  product_name: string;
  product_description: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  sale_date: string;
  total_amount: number;
  down_payment: number | null;
  installments: number;
  installment_value: number;
  first_due_date: string;
  remaining_balance: number;
  total_paid: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSalePayment {
  id: string;
  product_sale_id: string;
  user_id: string;
  amount: number;
  installment_number: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  productSale?: ProductSale;
}

export interface InstallmentDate {
  number: number;
  date: string;
}

export interface CreateProductSaleData {
  product_name: string;
  product_description?: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  sale_date: string;
  total_amount: number;
  down_payment?: number;
  installments: number;
  installment_value: number;
  first_due_date: string;
  notes?: string;
  installmentDates?: InstallmentDate[];
}

export interface UpdateProductSaleData {
  product_name?: string;
  product_description?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  notes?: string;
}

export function useProductSales() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sales, isLoading, error } = useQuery({
    queryKey: ['product-sales', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('product_sales')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProductSale[];
    },
    enabled: !!user,
  });

  const createSale = useMutation({
    mutationFn: async (saleData: CreateProductSaleData) => {
      if (!user) throw new Error('Usuário não autenticado');

      const downPayment = saleData.down_payment || 0;
      const remainingBalance = saleData.total_amount - downPayment;

      // Create the product sale
      const { data: sale, error: saleError } = await supabase
        .from('product_sales')
        .insert({
          user_id: user.id,
          product_name: saleData.product_name,
          product_description: saleData.product_description,
          client_name: saleData.client_name,
          client_phone: saleData.client_phone,
          client_email: saleData.client_email,
          sale_date: saleData.sale_date,
          total_amount: saleData.total_amount,
          down_payment: downPayment,
          installments: saleData.installments,
          installment_value: saleData.installment_value,
          first_due_date: saleData.first_due_date,
          remaining_balance: remainingBalance,
          total_paid: downPayment,
          notes: saleData.notes,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create payment installments
      const payments = [];
      for (let i = 0; i < saleData.installments; i++) {
        // Use custom dates if provided, otherwise calculate
        const dueDate = saleData.installmentDates?.[i]?.date 
          ? saleData.installmentDates[i].date
          : format(addMonths(new Date(saleData.first_due_date), i), 'yyyy-MM-dd');
        
        payments.push({
          product_sale_id: sale.id,
          user_id: user.id,
          amount: saleData.installment_value,
          installment_number: i + 1,
          due_date: dueDate,
          status: 'pending',
        });
      }

      const { error: paymentsError } = await supabase
        .from('product_sale_payments')
        .insert(payments);

      if (paymentsError) throw paymentsError;

      // Send WhatsApp notification - fetch user phone first
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        if (profile?.phone) {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: profile.phone,
              message: `🛒 *Nova Venda Cadastrada!*\n\n📦 Produto: ${saleData.product_name}\n👤 Cliente: ${saleData.client_name}\n💰 Valor Total: R$ ${saleData.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📅 Parcelas: ${saleData.installments}x de R$ ${saleData.installment_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📆 Primeiro Vencimento: ${format(new Date(saleData.first_due_date), 'dd/MM/yyyy')}`,
            },
          });
        }
      } catch (err) {
        console.error('Erro ao enviar WhatsApp:', err);
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['product-sale-payments'] });
      toast({
        title: 'Venda cadastrada',
        description: 'A venda foi registrada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao cadastrar venda',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateSale = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProductSaleData & { id: string }) => {
      const { data, error } = await supabase
        .from('product_sales')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sales'] });
      toast({
        title: 'Venda atualizada',
        description: 'Os dados foram atualizados com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['product-sale-payments'] });
      toast({
        title: 'Venda excluída',
        description: 'A venda foi removida com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    sales,
    isLoading,
    error,
    createSale,
    updateSale,
    deleteSale,
  };
}

export function useProductSalePayments(saleId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['product-sale-payments', user?.id, saleId],
    queryFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      let query = supabase
        .from('product_sale_payments')
        .select('*, productSale:product_sales(*)')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true });

      if (saleId) {
        query = query.eq('product_sale_id', saleId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProductSalePayment[];
    },
    enabled: !!user,
  });

  const markAsPaid = useMutation({
    mutationFn: async ({ paymentId, paidDate }: { paymentId: string; paidDate: string }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Get payment details
      const { data: payment, error: fetchError } = await supabase
        .from('product_sale_payments')
        .select('*, productSale:product_sales(*)')
        .eq('id', paymentId)
        .single();

      if (fetchError) throw fetchError;

      // Update payment status
      const { error: updateError } = await supabase
        .from('product_sale_payments')
        .update({
          status: 'paid',
          paid_date: paidDate,
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Update product sale totals
      const newTotalPaid = (payment.productSale?.total_paid || 0) + payment.amount;
      const newRemainingBalance = (payment.productSale?.remaining_balance || 0) - payment.amount;

      const { error: saleError } = await supabase
        .from('product_sales')
        .update({
          total_paid: newTotalPaid,
          remaining_balance: Math.max(0, newRemainingBalance),
          status: newRemainingBalance <= 0 ? 'paid' : 'pending',
        })
        .eq('id', payment.product_sale_id);

      if (saleError) throw saleError;

      // Send WhatsApp notification - fetch user phone first
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        if (profile?.phone) {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: profile.phone,
              message: `✅ *Pagamento de Venda Recebido!*\n\n📦 Produto: ${payment.productSale?.product_name}\n👤 Cliente: ${payment.productSale?.client_name}\n💵 Valor: R$ ${payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📋 Parcela: ${payment.installment_number}/${payment.productSale?.installments}\n💰 Restante: R$ ${Math.max(0, newRemainingBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            },
          });
        }
      } catch (err) {
        console.error('Erro ao enviar WhatsApp:', err);
      }

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['product-sale-payments'] });
      toast({
        title: 'Pagamento registrado',
        description: 'O pagamento foi marcado como pago.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao registrar pagamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    payments,
    isLoading,
    error,
    markAsPaid,
  };
}
