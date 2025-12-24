import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addMonths, format, parseISO } from 'date-fns';

export interface ProductSale {
  id: string;
  user_id: string;
  product_name: string;
  product_description: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_cpf: string | null;
  client_rg: string | null;
  client_address: string | null;
  sale_date: string;
  total_amount: number;
  cost_value: number;
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
  isPaid?: boolean; // For historical contracts
  amount?: number; // For editing individual installment amounts
}

export interface CreateProductSaleData {
  product_name: string;
  product_description?: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_cpf?: string;
  client_rg?: string;
  client_address?: string;
  sale_date: string;
  total_amount: number;
  cost_value?: number;
  down_payment?: number;
  installments: number;
  installment_value: number;
  first_due_date: string;
  notes?: string;
  installmentDates?: InstallmentDate[];
  send_creation_notification?: boolean;
  is_historical?: boolean; // Flag for historical contracts
}

export interface UpdateProductSaleData {
  product_name?: string;
  product_description?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_cpf?: string;
  client_rg?: string;
  client_address?: string;
  notes?: string;
  cost_value?: number;
  total_amount?: number;
  down_payment?: number;
  installments?: number;
  installment_value?: number;
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
          cost_value: saleData.cost_value || 0,
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
      let paidCount = 0;
      let paidAmount = 0;
      
      for (let i = 0; i < saleData.installments; i++) {
        // Use custom dates if provided, otherwise calculate
        const dueDate = saleData.installmentDates?.[i]?.date 
          ? saleData.installmentDates[i].date
          : format(addMonths(parseISO(saleData.first_due_date), i), 'yyyy-MM-dd');
        
        const isPaid = saleData.is_historical && saleData.installmentDates?.[i]?.isPaid === true;
        
        if (isPaid) {
          paidCount++;
          paidAmount += saleData.installment_value;
        }
        
        payments.push({
          product_sale_id: sale.id,
          user_id: user.id,
          amount: saleData.installment_value,
          installment_number: i + 1,
          due_date: dueDate,
          status: isPaid ? 'paid' : 'pending',
          paid_date: isPaid ? format(new Date(), 'yyyy-MM-dd') : null,
          notes: isPaid ? '[CONTRATO_ANTIGO]' : null,
        });
      }

      const { error: paymentsError } = await supabase
        .from('product_sale_payments')
        .insert(payments);

      if (paymentsError) throw paymentsError;
      
      // Update sale totals if there were pre-paid installments
      if (paidCount > 0) {
        const newTotalPaid = downPayment + paidAmount;
        const newRemainingBalance = saleData.total_amount - newTotalPaid;
        
        await supabase
          .from('product_sales')
          .update({
            total_paid: newTotalPaid,
            remaining_balance: newRemainingBalance,
            status: newRemainingBalance <= 0 ? 'paid' : 'pending',
          })
          .eq('id', sale.id);
      }

      // Send WhatsApp notification via Cobrafacilapp instance
      if (saleData.client_phone) {
        try {
          const formatCurrency = (value: number) => {
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(value);
          };

          const formatDate = (dateStr: string) => {
            const date = new Date(dateStr + 'T12:00:00');
            return date.toLocaleDateString('pt-BR');
          };

          const message = `✅ *COMPRA REALIZADA*

Olá ${saleData.client_name}!

Sua compra foi registrada com sucesso:

📦 *Produto:* ${saleData.product_name}
💰 *Valor Total:* ${formatCurrency(saleData.total_amount)}
${downPayment > 0 ? `💵 *Entrada:* ${formatCurrency(downPayment)}\n` : ''}📅 *Parcelas:* ${saleData.installments}x de ${formatCurrency(saleData.installment_value)}
📆 *1º Vencimento:* ${formatDate(saleData.first_due_date)}

Obrigado pela preferência! 🙏`;

          await supabase.functions.invoke('send-whatsapp-cobrafacil', {
            body: {
              phone: saleData.client_phone,
              message: message,
            },
          });

          console.log('WhatsApp notification sent via Cobrafacilapp');
        } catch (whatsappError) {
          console.error('Error sending WhatsApp notification:', whatsappError);
          // Don't throw - sale was created successfully
        }
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

  const updateSaleWithPayments = useMutation({
    mutationFn: async ({ 
      id, 
      data, 
      payments 
    }: { 
      id: string; 
      data: UpdateProductSaleData;
      payments?: InstallmentDate[];
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Update product sale basic data
      const { error: saleError } = await supabase
        .from('product_sales')
        .update({
          product_name: data.product_name,
          product_description: data.product_description,
          client_name: data.client_name,
          client_phone: data.client_phone,
          client_email: data.client_email,
          client_cpf: data.client_cpf,
          client_rg: data.client_rg,
          client_address: data.client_address,
          cost_value: data.cost_value,
          total_amount: data.total_amount,
          down_payment: data.down_payment,
          installments: data.installments,
          installment_value: data.installment_value,
          notes: data.notes,
        })
        .eq('id', id);

      if (saleError) throw saleError;

      // 2. If payments provided, delete old and create new
      if (payments && payments.length > 0) {
        // Delete existing payments
        const { error: deleteError } = await supabase
          .from('product_sale_payments')
          .delete()
          .eq('product_sale_id', id);

        if (deleteError) throw deleteError;

        // Insert new payments
        const newPayments = payments.map(p => ({
          product_sale_id: id,
          user_id: user.id,
          installment_number: p.number,
          amount: p.amount || data.installment_value || 0,
          due_date: p.date,
          status: p.isPaid ? 'paid' : 'pending',
          paid_date: p.isPaid ? format(new Date(), 'yyyy-MM-dd') : null,
        }));

        const { error: insertError } = await supabase
          .from('product_sale_payments')
          .insert(newPayments);

        if (insertError) throw insertError;

        // 3. Recalculate totals
        const downPayment = data.down_payment || 0;
        const paidAmount = payments
          .filter(p => p.isPaid)
          .reduce((sum, p) => sum + (p.amount || data.installment_value || 0), 0);
        const totalPaid = downPayment + paidAmount;
        const totalAmount = data.total_amount || 0;
        const remainingBalance = totalAmount - totalPaid;

        const { error: updateTotalsError } = await supabase
          .from('product_sales')
          .update({
            total_paid: totalPaid,
            remaining_balance: Math.max(0, remainingBalance),
            status: remainingBalance <= 0 ? 'paid' : 'pending',
          })
          .eq('id', id);

        if (updateTotalsError) throw updateTotalsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['product-sale-payments'] });
      toast({
        title: 'Venda atualizada',
        description: 'Todos os dados foram atualizados com sucesso.',
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
    updateSaleWithPayments,
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

      // WhatsApp notifications removed - only sent via explicit user click

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

  // Flexible payment - handles underpayment (creates new installment) and overpayment (deducts from total)
  const markAsPaidFlexible = useMutation({
    mutationFn: async ({ 
      paymentId, 
      paidDate, 
      paidAmount,
      originalAmount 
    }: { 
      paymentId: string; 
      paidDate: string; 
      paidAmount: number;
      originalAmount: number;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Get payment details
      const { data: payment, error: fetchError } = await supabase
        .from('product_sale_payments')
        .select('*, productSale:product_sales(*)')
        .eq('id', paymentId)
        .single();

      if (fetchError) throw fetchError;

      const sale = payment.productSale;
      const remainder = originalAmount - paidAmount;
      const overpayment = paidAmount > originalAmount ? paidAmount - originalAmount : 0;

      // Build notes based on payment type
      let paymentNotes = null;
      if (remainder > 0.01) {
        paymentNotes = `[PAGAMENTO_PARCIAL] Valor original: R$ ${originalAmount.toFixed(2)}, pago: R$ ${paidAmount.toFixed(2)}`;
      } else if (overpayment > 0.01) {
        paymentNotes = `[OVERPAYMENT] Valor original: R$ ${originalAmount.toFixed(2)}, pago: R$ ${paidAmount.toFixed(2)}, excedente: R$ ${overpayment.toFixed(2)}`;
      }

      // Update payment status with actual paid amount
      const { error: updateError } = await supabase
        .from('product_sale_payments')
        .update({
          status: 'paid',
          paid_date: paidDate,
          amount: paidAmount,
          notes: paymentNotes,
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      let newInstallmentNumber = 0;

      // UNDERPAYMENT: Create new installment with remainder
      if (remainder > 0.01) {
        // Get max installment number
        const { data: existingPayments } = await supabase
          .from('product_sale_payments')
          .select('installment_number')
          .eq('product_sale_id', payment.product_sale_id)
          .order('installment_number', { ascending: false })
          .limit(1);
        
        const maxInstallment = existingPayments?.[0]?.installment_number || 0;
        newInstallmentNumber = maxInstallment + 1;
        
        // MANTER A MESMA DATA DE VENCIMENTO ORIGINAL para mostrar como atrasada (sub-parcela)
        // Create new installment as sub-parcela with same due date
        const { error: insertError } = await supabase
          .from('product_sale_payments')
          .insert({
            user_id: user.id,
            product_sale_id: payment.product_sale_id,
            installment_number: newInstallmentNumber,
            amount: remainder,
            due_date: payment.due_date, // Mantém a data original para aparecer como atrasada
            status: 'pending',
            notes: `[SUBPARCELA] Restante da parcela ${payment.installment_number} (R$ ${originalAmount.toFixed(2)} - pago R$ ${paidAmount.toFixed(2)})`,
          });

        if (insertError) throw insertError;

        // Update installments count
        await supabase
          .from('product_sales')
          .update({ installments: newInstallmentNumber })
          .eq('id', payment.product_sale_id);
      }

      // Update product sale totals
      const newTotalPaid = (sale?.total_paid || 0) + paidAmount;
      const newRemainingBalance = (sale?.remaining_balance || 0) - paidAmount;

      const { error: saleError } = await supabase
        .from('product_sales')
        .update({
          total_paid: newTotalPaid,
          remaining_balance: Math.max(0, newRemainingBalance),
          status: newRemainingBalance <= 0 ? 'paid' : 'pending',
        })
        .eq('id', payment.product_sale_id);

      if (saleError) throw saleError;

      // WhatsApp notifications removed - only sent via explicit user click

      return { 
        payment, 
        remainder: remainder > 0.01 ? remainder : 0, 
        overpayment,
        newInstallmentCreated: remainder > 0.01,
        newRemainingBalance: Math.max(0, newRemainingBalance),
        newTotalPaid,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-sales'] });
      queryClient.invalidateQueries({ queryKey: ['product-sale-payments'] });
      
      if (result.newInstallmentCreated) {
        toast({
          title: 'Pagamento registrado',
          description: `Nova parcela de R$ ${result.remainder.toFixed(2)} criada para o valor restante.`,
        });
      } else if (result.overpayment > 0.01) {
        toast({
          title: 'Pagamento registrado',
          description: `Excedente de R$ ${result.overpayment.toFixed(2)} abatido do saldo total.`,
        });
      } else {
        toast({
          title: 'Pagamento registrado',
          description: 'O pagamento foi marcado como pago.',
        });
      }
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
    markAsPaidFlexible,
  };
}
