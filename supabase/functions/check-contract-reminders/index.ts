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
  // Usar instância fixa "notficacao" para notificações do sistema
  const instanceName = "notficacao";

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error("Missing Evolution API configuration");
    return false;
  }
  
  console.log("Using fixed system instance: notficacao");

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
  console.log("check-contract-reminders function called at", new Date().toISOString());
  
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

    console.log("Checking contract reminders for TODAY:", todayStr);

    // Get all ACTIVE users with phone configured
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .eq('is_active', true)
      .not('phone', 'is', null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;
    const notifications: any[] = [];

    for (const profile of profiles || []) {
      // Fetch contract payments due TODAY
      const { data: contractPayments, error: cpError } = await supabase
        .from('contract_payments')
        .select(`
          *,
          contracts!inner(client_name, contract_type, bill_type)
        `)
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .eq('due_date', todayStr);

      if (cpError) {
        console.error(`Error fetching contract payments for user ${profile.id}:`, cpError);
      }

      // Fetch bills due TODAY
      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .eq('due_date', todayStr);

      if (billsError) {
        console.error(`Error fetching bills for user ${profile.id}:`, billsError);
      }

      // Separate by bill_type
      const receivables: any[] = [];
      const payables: any[] = [];

      // Process contract payments
      for (const cp of contractPayments || []) {
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

      // Process bills (all are payable)
      for (const bill of bills || []) {
        payables.push({
          type: 'bill',
          name: bill.payee_name,
          description: bill.description,
          amount: bill.amount,
          dueDate: bill.due_date,
        });
      }

      // Send messages if there are items due today
      if (receivables.length > 0 && profile.phone) {
        const totalReceivable = receivables.reduce((sum, r) => sum + Number(r.amount), 0);
        const itemsList = receivables.map(r => 
          `• *${r.name}*: ${formatCurrency(r.amount)} (${r.description}${r.installment ? ` - Parcela ${r.installment}` : ''})`
        ).join('\n');

        const message = `💰 *CONTAS A RECEBER - VENCIMENTO HOJE!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${receivables.length} cobrança${receivables.length > 1 ? 's' : ''}* que vence${receivables.length > 1 ? 'm' : ''} *HOJE*:\n\n${itemsList}\n\n💵 *Total a receber: ${formatCurrency(totalReceivable)}*\n\n📲 Não deixe de cobrar!\n\n_CobraFácil - Alerta automático_`;

        console.log(`Sending receivables reminder to user ${profile.id}`);
        const sent = await sendWhatsApp(profile.phone, message);
        if (sent) sentCount++;
      }

      if (payables.length > 0 && profile.phone) {
        const totalPayable = payables.reduce((sum, p) => sum + Number(p.amount), 0);
        const itemsList = payables.map(p => 
          `• *${p.name}*: ${formatCurrency(p.amount)} (${p.description}${p.installment ? ` - Parcela ${p.installment}` : ''})`
        ).join('\n');

        const message = `💸 *CONTAS A PAGAR - VENCIMENTO HOJE!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${payables.length} conta${payables.length > 1 ? 's' : ''}* que vence${payables.length > 1 ? 'm' : ''} *HOJE*:\n\n${itemsList}\n\n💳 *Total a pagar: ${formatCurrency(totalPayable)}*\n\n⚠️ Não esqueça de pagar!\n\n_CobraFácil - Alerta automático_`;

        console.log(`Sending payables reminder to user ${profile.id}`);
        const sent = await sendWhatsApp(profile.phone, message);
        if (sent) sentCount++;
      }

      // Create in-app notifications (even without phone)
      if (receivables.length > 0) {
        const totalReceivable = receivables.reduce((sum, r) => sum + Number(r.amount), 0);
        notifications.push({
          user_id: profile.id,
          title: '💰 Contas a Receber Hoje',
          message: `${receivables.length} cobrança(s) vencem hoje - Total: ${formatCurrency(totalReceivable)}`,
          type: 'warning',
        });
      }

      if (payables.length > 0) {
        const totalPayable = payables.reduce((sum, p) => sum + Number(p.amount), 0);
        notifications.push({
          user_id: profile.id,
          title: '💸 Contas a Pagar Hoje',
          message: `${payables.length} conta(s) vencem hoje - Total: ${formatCurrency(totalPayable)}`,
          type: 'warning',
        });
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

    console.log(`Sent ${sentCount} contract reminder messages, created ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        notificationsCreated: notifications.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-contract-reminders:", error);
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
