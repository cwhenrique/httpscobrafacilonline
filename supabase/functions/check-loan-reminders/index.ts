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

const sendWhatsApp = async (phone: string, message: string): Promise<boolean> => {
  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
    console.error("Missing Evolution API configuration");
    return false;
  }

  // Format phone number
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

const handler = async (req: Request): Promise<Response> => {
  console.log("check-loan-reminders function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate dates for 1, 3, and 7 days ahead
    const reminderDays = [1, 3, 7];
    const reminderDates = reminderDays.map(days => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return { days, date: date.toISOString().split('T')[0] };
    });

    console.log("Checking reminders for dates:", reminderDates);

    // Fetch all pending loans with client data
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(`
        *,
        clients!inner(full_name, phone)
      `)
      .eq('status', 'pending');

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      throw loansError;
    }

    console.log(`Found ${loans?.length || 0} pending loans`);

    let sentCount = 0;
    const notifications: any[] = [];

    for (const loan of loans || []) {
      const client = loan.clients as { full_name: string; phone: string | null };
      
      if (!client.phone) {
        console.log(`Client ${client.full_name} has no phone number, skipping`);
        continue;
      }

      // Check installment dates
      const installmentDates = (loan.installment_dates as string[]) || [];
      const numInstallments = loan.installments || 1;
      const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

      let nextDueDate: string | null = null;
      let installmentAmount = totalPerInstallment;

      if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
        nextDueDate = installmentDates[paidInstallments];
      } else {
        nextDueDate = loan.due_date;
        // For single payment, remaining balance is the amount
        if (loan.payment_type === 'single') {
          installmentAmount = loan.remaining_balance + (loan.principal_amount * (loan.interest_rate / 100));
        }
      }

      if (!nextDueDate) continue;

      // Check if due date matches any reminder date
      for (const reminder of reminderDates) {
        if (nextDueDate === reminder.date) {
          const dueDate = new Date(nextDueDate);
          const message = `📅 *Lembrete de Pagamento*\n\nOlá ${client.full_name}!\n\nSeu pagamento no valor de ${formatCurrency(installmentAmount)} vence em *${reminder.days} dia${reminder.days > 1 ? 's' : ''}* (${formatDate(dueDate)}).\n\nEvite juros e multas, efetue o pagamento em dia!\n\n_Mensagem automática_`;

          console.log(`Sending ${reminder.days}-day reminder to ${client.full_name}`);
          
          const sent = await sendWhatsApp(client.phone, message);
          if (sent) {
            sentCount++;
            notifications.push({
              user_id: loan.user_id,
              loan_id: loan.id,
              client_id: loan.client_id,
              title: `📱 Lembrete Enviado`,
              message: `Lembrete de ${reminder.days} dia(s) enviado para ${client.full_name}`,
              type: 'info',
            });
          }
          break; // Only send one reminder per loan
        }
      }
    }

    // Create in-app notifications for sent messages
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.error("Error creating notifications:", notifError);
      }
    }

    console.log(`Sent ${sentCount} reminder messages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        checkedLoans: loans?.length || 0 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-loan-reminders:", error);
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
