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

    // Calculate dates for TODAY (0), 1, 3, and 7 days ahead
    const reminderDays = [0, 1, 3, 7];
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

    // Group loans by user_id to send consolidated messages
    const userLoansMap: Map<string, { 
      loans: any[], 
      reminderDay: number 
    }[]> = new Map();

    for (const loan of loans || []) {
      const client = loan.clients as { full_name: string; phone: string | null };
      
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
        if (loan.payment_type === 'single') {
          installmentAmount = loan.remaining_balance + (loan.principal_amount * (loan.interest_rate / 100));
        }
      }

      if (!nextDueDate) continue;

      // Check if due date matches any reminder date
      for (const reminder of reminderDates) {
        if (nextDueDate === reminder.date) {
          const loanInfo = {
            ...loan,
            clientName: client.full_name,
            clientPhone: client.phone,
            installmentAmount,
            dueDate: nextDueDate,
          };

          if (!userLoansMap.has(loan.user_id)) {
            userLoansMap.set(loan.user_id, []);
          }
          
          const existingReminder = userLoansMap.get(loan.user_id)!.find(r => r.reminderDay === reminder.days);
          if (existingReminder) {
            existingReminder.loans.push(loanInfo);
          } else {
            userLoansMap.get(loan.user_id)!.push({ loans: [loanInfo], reminderDay: reminder.days });
          }
          break;
        }
      }
    }

    let sentCount = 0;
    const notifications: any[] = [];

    // Get user profiles to get their phone numbers
    for (const [userId, reminders] of userLoansMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping`);
        continue;
      }

      for (const reminder of reminders) {
        const loansList = reminder.loans.map(l => 
          `• *${l.clientName}*: ${formatCurrency(l.installmentAmount)} (vence ${formatDate(new Date(l.dueDate))})`
        ).join('\n');

        const totalAmount = reminder.loans.reduce((sum, l) => sum + l.installmentAmount, 0);

        let message: string;
        let notifTitle: string;
        
        if (reminder.reminderDay === 0) {
          // Same day - TODAY
          message = `⏰ *VENCIMENTO HOJE!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${reminder.loans.length} cobrança${reminder.loans.length > 1 ? 's' : ''}* que vence${reminder.loans.length > 1 ? 'm' : ''} *HOJE*:\n\n${loansList}\n\n💰 *Total a receber: ${formatCurrency(totalAmount)}*\n\nNão deixe de cobrar!\n\n_CobraFácil - Alerta automático_`;
          notifTitle = `⏰ Vencimento Hoje`;
        } else if (reminder.reminderDay === 1) {
          message = `📅 *Vencimento Amanhã*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${reminder.loans.length} cobrança${reminder.loans.length > 1 ? 's' : ''}* que vence${reminder.loans.length > 1 ? 'm' : ''} *amanhã*:\n\n${loansList}\n\n💰 *Total a receber: ${formatCurrency(totalAmount)}*\n\nPrepare-se para cobrar!\n\n_CobraFácil - Lembrete automático_`;
          notifTitle = `📅 Vencimento Amanhã`;
        } else {
          message = `📋 *Lembrete de Cobranças*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${reminder.loans.length} cobrança${reminder.loans.length > 1 ? 's' : ''}* para os próximos *${reminder.reminderDay} dias*:\n\n${loansList}\n\n💰 *Total a receber: ${formatCurrency(totalAmount)}*\n\n_CobraFácil - Lembrete automático_`;
          notifTitle = `📋 Lembrete ${reminder.reminderDay} dias`;
        }

        console.log(`Sending ${reminder.reminderDay}-day reminder to user ${userId}`);
        
        const sent = await sendWhatsApp(profile.phone, message);
        if (sent) {
          sentCount++;
          notifications.push({
            user_id: userId,
            title: notifTitle,
            message: `${reminder.loans.length} cobrança(s) - Total: ${formatCurrency(totalAmount)}`,
            type: 'info',
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
