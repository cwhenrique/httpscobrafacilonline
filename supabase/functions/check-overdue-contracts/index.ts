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

const sendWhatsApp = async (phone: string, message: string, instanceToken: string): Promise<boolean> => {
  const uazapiUrl = Deno.env.get("UAZAPI_URL");
  if (!uazapiUrl || !instanceToken) {
    console.error("Missing UAZAPI URL or instance token");
    return false;
  }

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": instanceToken },
      body: JSON.stringify({ number: cleaned, text: message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send WhatsApp to ${cleaned}: ${errorText}`);
      return false;
    }

    console.log(`WhatsApp sent to ${cleaned} via UAZAPI`);
    return true;
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

// Helper para extrair configuração de multa por atraso das notas
// Formato: [OVERDUE_CONFIG:percentage:1] ou [OVERDUE_CONFIG:fixed:5.00]
const getOverdueConfigFromNotes = (notes: string | null): { type: 'percentage' | 'fixed' | 'percentage_total'; value: number } | null => {
  const match = (notes || '').match(/\[OVERDUE_CONFIG:(percentage_total|percentage|fixed):([0-9.]+)\]/);
  if (!match) return null;
  return {
    type: match[1] as 'percentage' | 'fixed' | 'percentage_total',
    value: parseFloat(match[2])
  };
};

// Helper para extrair multas já aplicadas
// Formato: [DAILY_PENALTY:índice:valor] ou [PENALTY:valor]
const getPenaltyFromNotes = (notes: string | null): number => {
  let total = 0;
  // Formato novo: [DAILY_PENALTY:índice:valor]
  const dailyMatches = (notes || '').matchAll(/\[DAILY_PENALTY:(\d+):([0-9.]+)\]/g);
  for (const match of dailyMatches) {
    total += parseFloat(match[2]);
  }
  // Formato simples: [PENALTY:valor]
  const simpleMatch = (notes || '').match(/\[PENALTY:([0-9.]+)\]/);
  if (simpleMatch) {
    total += parseFloat(simpleMatch[1]);
  }
  return total;
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

    // Get all ACTIVE users with phone configured
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, full_name, whatsapp_instance_token')
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('whatsapp_instance_token', 'is', null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;
    let updatedCount = 0;

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
            const contract = cp.contracts as { client_name: string; contract_type: string; bill_type: string; notes?: string };
            
            // Extrair multa e config de juros das notas
            const penalty = getPenaltyFromNotes(cp.notes);
            const overdueConfig = getOverdueConfigFromNotes(cp.notes);
            
            const item = {
              type: 'contract',
              name: contract.client_name,
              description: getContractTypeLabel(contract.contract_type),
              amount: cp.amount,
              originalAmount: cp.amount - penalty,
              penalty: penalty,
              overdueConfig: overdueConfig,
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
          const totalPenalties = receivables.reduce((sum, r) => sum + (r.penalty || 0), 0);
          
          const itemsList = receivables.map(r => {
            let itemLine = `• *${r.name}*: ${formatCurrency(r.amount)} (${r.description}${r.installment ? ` - Parcela ${r.installment}` : ''})`;
            if (r.penalty > 0) {
              itemLine += `\n   ⚠️ Multa: +${formatCurrency(r.penalty)}`;
            }
            if (r.overdueConfig) {
              const taxaInfo = r.overdueConfig.type === 'percentage' 
                ? `${r.overdueConfig.value}% ao dia`
                : r.overdueConfig.type === 'percentage_total'
                  ? `${r.overdueConfig.value}% do total/30 dias`
                  : `${formatCurrency(r.overdueConfig.value)}/dia`;
              itemLine += `\n   📈 Taxa atraso: ${taxaInfo}`;
            }
            return itemLine;
          }).join('\n');

          let message: string;
          if (overdueInfo.days === 1) {
            message = `⚠️ *CONTAS A RECEBER - 1 DIA DE ATRASO*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${receivables.length} cobrança${receivables.length > 1 ? 's' : ''}* com *1 dia de atraso*:\n\n${itemsList}\n\n`;
            if (totalPenalties > 0) {
              message += `⚠️ *Multas aplicadas: ${formatCurrency(totalPenalties)}*\n`;
            }
            message += `💵 *Total em atraso: ${formatCurrency(totalReceivable)}*\n\n📲 Entre em contato para cobrar!\n\n_CobraFácil - Alerta de atraso_`;
          } else {
            message = `🚨 *CONTAS A RECEBER - 3 DIAS DE ATRASO!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nATENÇÃO! Você tem *${receivables.length} cobrança${receivables.length > 1 ? 's' : ''}* com *3 dias de atraso*:\n\n${itemsList}\n\n`;
            if (totalPenalties > 0) {
              message += `⚠️ *Multas aplicadas: ${formatCurrency(totalPenalties)}*\n`;
            }
            message += `💵 *Total em atraso: ${formatCurrency(totalReceivable)}*\n\n📞 Cobre novamente urgentemente!\n\n_CobraFácil - Alerta urgente_`;
          }

          console.log(`Sending ${overdueInfo.days}-day receivables overdue alert to user ${profile.id}`);
          const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
          if (sent) sentCount++;
        }

        // Send alerts for payables
        if (payables.length > 0 && profile.phone) {
          const totalPayable = payables.reduce((sum, p) => sum + Number(p.amount), 0);
          const totalPenalties = payables.reduce((sum, p) => sum + (p.penalty || 0), 0);
          
          const itemsList = payables.map(p => {
            let itemLine = `• *${p.name}*: ${formatCurrency(p.amount)} (${p.description}${p.installment ? ` - Parcela ${p.installment}` : ''})`;
            if (p.penalty > 0) {
              itemLine += `\n   ⚠️ Multa: +${formatCurrency(p.penalty)}`;
            }
            if (p.overdueConfig) {
              const taxaInfo = p.overdueConfig.type === 'percentage' 
                ? `${p.overdueConfig.value}% ao dia`
                : p.overdueConfig.type === 'percentage_total'
                  ? `${p.overdueConfig.value}% do total/30 dias`
                  : `${formatCurrency(p.overdueConfig.value)}/dia`;
              itemLine += `\n   📈 Taxa atraso: ${taxaInfo}`;
            }
            return itemLine;
          }).join('\n');

          let message: string;
          if (overdueInfo.days === 1) {
            message = `⚠️ *CONTAS A PAGAR - 1 DIA DE ATRASO*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${payables.length} conta${payables.length > 1 ? 's' : ''}* com *1 dia de atraso*:\n\n${itemsList}\n\n`;
            if (totalPenalties > 0) {
              message += `⚠️ *Multas acumuladas: ${formatCurrency(totalPenalties)}*\n`;
            }
            message += `💳 *Total em atraso: ${formatCurrency(totalPayable)}*\n\n💸 Regularize o quanto antes!\n\n_CobraFácil - Alerta de atraso_`;
          } else {
            message = `🚨 *CONTAS A PAGAR - 3 DIAS DE ATRASO!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nURGENTE! Você tem *${payables.length} conta${payables.length > 1 ? 's' : ''}* com *3 dias de atraso*:\n\n${itemsList}\n\n`;
            if (totalPenalties > 0) {
              message += `⚠️ *Multas acumuladas: ${formatCurrency(totalPenalties)}*\n`;
            }
            message += `💳 *Total em atraso: ${formatCurrency(totalPayable)}*\n\n⚠️ Regularize imediatamente para evitar problemas!\n\n_CobraFácil - Alerta urgente_`;
          }

          console.log(`Sending ${overdueInfo.days}-day payables overdue alert to user ${profile.id}`);
          const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
          if (sent) sentCount++;
        }

      }
    }

    console.log(`Sent ${sentCount} overdue alerts, updated ${updatedCount} items to overdue`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        updatedCount,
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
