import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

const cleanApiUrl = (url: string): string => {
  let cleaned = url.replace(/\/+$/, '');
  const pathPatterns = [
    /\/message\/sendText\/[^\/]+$/i,
    /\/message\/sendText$/i,
    /\/message$/i,
  ];
  for (const pattern of pathPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned;
};

const sendWhatsApp = async (phone: string, message: string): Promise<boolean> => {
  const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionApiUrlRaw || !evolutionApiKey || !instanceName) {
    console.error("Missing Evolution API configuration");
    return false;
  }

  const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  try {
    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({
          number: cleaned,
          text: message,
        }),
      }
    );

    const data = await response.json();
    console.log(`WhatsApp sent to ${cleaned}:`, data);
    return response.ok;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${cleaned}:`, error);
    return false;
  }
};

const getContractTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    'aluguel_casa': 'Aluguel Casa',
    'aluguel_kitnet': 'Aluguel Kitnet',
    'aluguel_apartamento': 'Aluguel Apartamento',
    'aluguel_sala': 'Aluguel Sala',
    'mensalidade': 'Mensalidade',
    'servico_mensal': 'Serviço Mensal',
    'parcelado': 'Parcelado',
    'avista': 'À Vista',
  };
  return labels[type] || type;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("check-overdue-contracts function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Calculate dates for 1 and 3 days ago
    const overdueDays = [1, 3];
    const overdueDates = overdueDays.map(days => {
      const date = new Date(today);
      date.setDate(date.getDate() - days);
      return { days, date: date.toISOString().split('T')[0] };
    });

    console.log("Checking overdue contracts for dates:", overdueDates);

    // Get all users with phone configured
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .not('phone', 'is', null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;
    let updatedCount = 0;
    const notifications: any[] = [];

    for (const profile of profiles || []) {
      // Fetch overdue contract payments
      const { data: contractPayments, error: cpError } = await supabase
        .from('contract_payments')
        .select(`
          *,
          contracts!inner(client_name, contract_type, bill_type)
        `)
        .eq('user_id', profile.id)
        .neq('status', 'paid')
        .lt('due_date', todayStr);

      if (cpError) {
        console.error(`Error fetching contract payments for user ${profile.id}:`, cpError);
      }

      // Fetch overdue bills
      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', profile.id)
        .neq('status', 'paid')
        .lt('due_date', todayStr);

      if (billsError) {
        console.error(`Error fetching bills for user ${profile.id}:`, billsError);
      }

      // Update status to overdue for all items
      const contractPaymentIds = (contractPayments || []).filter(cp => cp.status === 'pending').map(cp => cp.id);
      const billIds = (bills || []).filter(b => b.status === 'pending').map(b => b.id);

      if (contractPaymentIds.length > 0) {
        const { error: updateError } = await supabase
          .from('contract_payments')
          .update({ status: 'overdue' })
          .in('id', contractPaymentIds);
        
        if (updateError) {
          console.error("Error updating contract payments status:", updateError);
        } else {
          updatedCount += contractPaymentIds.length;
        }
      }

      if (billIds.length > 0) {
        const { error: updateError } = await supabase
          .from('bills')
          .update({ status: 'overdue' })
          .in('id', billIds);
        
        if (updateError) {
          console.error("Error updating bills status:", updateError);
        } else {
          updatedCount += billIds.length;
        }
      }

      // Group by overdue days (1 and 3) and bill_type
      for (const overdueInfo of overdueDates) {
        const receivables: any[] = [];
        const payables: any[] = [];

        // Filter contract payments by exact overdue days
        for (const cp of contractPayments || []) {
          if (cp.due_date === overdueInfo.date) {
            const contract = cp.contracts as { client_name: string; contract_type: string; bill_type: string };
            const item = {
              type: 'contract',
              name: contract.client_name,
              description: getContractTypeLabel(contract.contract_type),
              amount: cp.amount,
              dueDate: cp.due_date,
              installment: cp.installment_number,
            };

            if (contract.bill_type === 'receivable') {
              receivables.push(item);
            } else {
              payables.push(item);
            }
          }
        }

        // Filter bills by exact overdue days (all are payable)
        for (const bill of bills || []) {
          if (bill.due_date === overdueInfo.date) {
            payables.push({
              type: 'bill',
              name: bill.payee_name,
              description: bill.description,
              amount: bill.amount,
              dueDate: bill.due_date,
            });
          }
        }

        // Send alerts for receivables
        if (receivables.length > 0 && profile.phone) {
          const totalReceivable = receivables.reduce((sum, r) => sum + Number(r.amount), 0);
          const itemsList = receivables.map(r => 
            `• *${r.name}*: ${formatCurrency(r.amount)} (${r.description}${r.installment ? ` - Parcela ${r.installment}` : ''})`
          ).join('\n');

          let message: string;
          if (overdueInfo.days === 1) {
            message = `⚠️ *CONTAS A RECEBER - 1 DIA DE ATRASO*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${receivables.length} cobrança${receivables.length > 1 ? 's' : ''}* com *1 dia de atraso*:\n\n${itemsList}\n\n💵 *Total em atraso: ${formatCurrency(totalReceivable)}*\n\n📲 Entre em contato para cobrar!\n\n_CobraFácil - Alerta de atraso_`;
          } else {
            message = `🚨 *CONTAS A RECEBER - 3 DIAS DE ATRASO!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nATENÇÃO! Você tem *${receivables.length} cobrança${receivables.length > 1 ? 's' : ''}* com *3 dias de atraso*:\n\n${itemsList}\n\n💵 *Total em atraso: ${formatCurrency(totalReceivable)}*\n\n📞 Cobre novamente urgentemente!\n\n_CobraFácil - Alerta urgente_`;
          }

          console.log(`Sending ${overdueInfo.days}-day receivables overdue alert to user ${profile.id}`);
          const sent = await sendWhatsApp(profile.phone, message);
          if (sent) sentCount++;
        }

        // Send alerts for payables
        if (payables.length > 0 && profile.phone) {
          const totalPayable = payables.reduce((sum, p) => sum + Number(p.amount), 0);
          const itemsList = payables.map(p => 
            `• *${p.name}*: ${formatCurrency(p.amount)} (${p.description}${p.installment ? ` - Parcela ${p.installment}` : ''})`
          ).join('\n');

          let message: string;
          if (overdueInfo.days === 1) {
            message = `⚠️ *CONTAS A PAGAR - 1 DIA DE ATRASO*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${payables.length} conta${payables.length > 1 ? 's' : ''}* com *1 dia de atraso*:\n\n${itemsList}\n\n💳 *Total em atraso: ${formatCurrency(totalPayable)}*\n\n💸 Regularize o quanto antes!\n\n_CobraFácil - Alerta de atraso_`;
          } else {
            message = `🚨 *CONTAS A PAGAR - 3 DIAS DE ATRASO!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nURGENTE! Você tem *${payables.length} conta${payables.length > 1 ? 's' : ''}* com *3 dias de atraso*:\n\n${itemsList}\n\n💳 *Total em atraso: ${formatCurrency(totalPayable)}*\n\n⚠️ Regularize imediatamente para evitar problemas!\n\n_CobraFácil - Alerta urgente_`;
          }

          console.log(`Sending ${overdueInfo.days}-day payables overdue alert to user ${profile.id}`);
          const sent = await sendWhatsApp(profile.phone, message);
          if (sent) sentCount++;
        }

        // Create in-app notifications
        if (receivables.length > 0) {
          const totalReceivable = receivables.reduce((sum, r) => sum + Number(r.amount), 0);
          notifications.push({
            user_id: profile.id,
            title: overdueInfo.days === 1 ? '⚠️ Recebíveis Atrasados (1 dia)' : '🚨 Recebíveis Atrasados (3 dias)',
            message: `${receivables.length} cobrança(s) - Total: ${formatCurrency(totalReceivable)}`,
            type: overdueInfo.days === 1 ? 'warning' : 'error',
          });
        }

        if (payables.length > 0) {
          const totalPayable = payables.reduce((sum, p) => sum + Number(p.amount), 0);
          notifications.push({
            user_id: profile.id,
            title: overdueInfo.days === 1 ? '⚠️ Contas Atrasadas (1 dia)' : '🚨 Contas Atrasadas (3 dias)',
            message: `${payables.length} conta(s) - Total: ${formatCurrency(totalPayable)}`,
            type: overdueInfo.days === 1 ? 'warning' : 'error',
          });
        }
      }
    }

    // Create in-app notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.error("Error creating notifications:", notifError);
      }
    }

    console.log(`Sent ${sentCount} overdue alerts, updated ${updatedCount} items to overdue, created ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        updatedCount,
        notificationsCreated: notifications.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-contracts:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
