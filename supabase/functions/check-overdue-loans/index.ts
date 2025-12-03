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
  console.log("check-overdue-loans function called at", new Date().toISOString());
  
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

    console.log("Checking for overdue loans as of:", todayStr);

    // Fetch all pending loans with client data
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(`
        *,
        clients!inner(full_name, phone)
      `)
      .in('status', ['pending', 'overdue']);

    if (loansError) {
      console.error("Error fetching loans:", loansError);
      throw loansError;
    }

    console.log(`Found ${loans?.length || 0} loans to check`);

    // Group overdue loans by user
    const userOverdueMap: Map<string, any[]> = new Map();
    const overdueUpdates: string[] = [];

    for (const loan of loans || []) {
      const client = loan.clients as { full_name: string; phone: string | null };
      
      // Calculate next due date
      const installmentDates = (loan.installment_dates as string[]) || [];
      const numInstallments = loan.installments || 1;
      const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

      let nextDueDate: string | null = null;
      let remainingAmount = 0;

      if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
        nextDueDate = installmentDates[paidInstallments];
        remainingAmount = totalPerInstallment * (numInstallments - paidInstallments);
      } else {
        nextDueDate = loan.due_date;
        remainingAmount = loan.remaining_balance + (loan.principal_amount * (loan.interest_rate / 100)) - (loan.total_paid || 0);
      }

      if (!nextDueDate) continue;

      const dueDate = new Date(nextDueDate);
      dueDate.setHours(0, 0, 0, 0);

      // Check if overdue
      if (dueDate < today) {
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Update loan status to overdue
        if (loan.status !== 'overdue') {
          overdueUpdates.push(loan.id);
        }

        const loanInfo = {
          ...loan,
          clientName: client.full_name,
          clientPhone: client.phone,
          remainingAmount: remainingAmount > 0 ? remainingAmount : totalPerInstallment,
          dueDate: nextDueDate,
          daysOverdue,
        };

        if (!userOverdueMap.has(loan.user_id)) {
          userOverdueMap.set(loan.user_id, []);
        }
        userOverdueMap.get(loan.user_id)!.push(loanInfo);
      }
    }

    // Update overdue loan statuses
    if (overdueUpdates.length > 0) {
      const { error: updateError } = await supabase
        .from('loans')
        .update({ status: 'overdue' })
        .in('id', overdueUpdates);
      
      if (updateError) {
        console.error("Error updating overdue statuses:", updateError);
      } else {
        console.log(`Updated ${overdueUpdates.length} loans to overdue status`);
      }
    }

    let sentCount = 0;
    const notifications: any[] = [];

    // Send consolidated message to each user
    for (const [userId, overdueLoans] of userOverdueMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping`);
        continue;
      }

      // Sort by days overdue (most overdue first)
      overdueLoans.sort((a, b) => b.daysOverdue - a.daysOverdue);

      const loansList = overdueLoans.slice(0, 10).map(l => 
        `• *${l.clientName}*: ${formatCurrency(l.remainingAmount)} (${l.daysOverdue} dia${l.daysOverdue > 1 ? 's' : ''} de atraso)`
      ).join('\n');

      const totalAmount = overdueLoans.reduce((sum, l) => sum + l.remainingAmount, 0);
      const moreLoans = overdueLoans.length > 10 ? `\n_... e mais ${overdueLoans.length - 10} empréstimo(s)_` : '';

      const message = `🚨 *Empréstimos em Atraso*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}!\n\nVocê tem *${overdueLoans.length} empréstimo${overdueLoans.length > 1 ? 's' : ''} em atraso*:\n\n${loansList}${moreLoans}\n\n💰 *Total pendente: ${formatCurrency(totalAmount)}*\n\nEntre em contato com seus clientes para regularizar!\n\n_CobraFácil - Alerta automático_`;

      console.log(`Sending overdue alert to user ${userId} (${overdueLoans.length} loans)`);
      
      const sent = await sendWhatsApp(profile.phone, message);
      if (sent) {
        sentCount++;
        notifications.push({
          user_id: userId,
          title: `🚨 Alerta de Atrasos`,
          message: `${overdueLoans.length} empréstimo(s) em atraso - Total: ${formatCurrency(totalAmount)}`,
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

    console.log(`Sent ${sentCount} overdue alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        overdueLoans: overdueUpdates.length,
        checkedLoans: loans?.length || 0 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-loans:", error);
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
