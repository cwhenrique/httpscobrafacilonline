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

const getContractId = (id: string, prefix: string): string => {
  return `${prefix}-${id.substring(0, 4).toUpperCase()}`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("daily-summary function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to check if this is a reminder (12h) or report (8h)
    let isReminder = false;
    try {
      const body = await req.json();
      isReminder = body.isReminder === true;
    } catch {
      // No body or invalid JSON, default to report mode
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Generating ${isReminder ? 'reminder (12h)' : 'report (8h)'} for:`, todayStr);

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

    for (const profile of profiles || []) {
      if (!profile.phone) continue;

      // ============= EMPRÉSTIMOS =============
      const { data: loans } = await supabase
        .from('loans')
        .select(`*, clients!inner(full_name, phone)`)
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue']);

      // ============= VEÍCULOS =============
      const { data: vehiclePayments } = await supabase
        .from('vehicle_payments')
        .select(`*, vehicles!inner(brand, model, year, plate, buyer_name, seller_name, user_id, purchase_value, total_paid, installments)`)
        .eq('status', 'pending')
        .gte('due_date', todayStr);

      // ============= PRODUTOS =============
      const { data: productPayments } = await supabase
        .from('product_sale_payments')
        .select(`*, productSale:product_sales!inner(product_name, client_name, user_id, total_amount, total_paid, installments)`)
        .eq('status', 'pending')
        .gte('due_date', todayStr);

      // Filter payments for this user
      const userVehiclePayments = (vehiclePayments || []).filter(p => (p.vehicles as any).user_id === profile.id);
      const userProductPayments = (productPayments || []).filter(p => (p.productSale as any).user_id === profile.id);

      // Categorize loans
      interface LoanInfo {
        id: string;
        clientName: string;
        amount: number;
        dueDate: string;
        daysOverdue?: number;
        paymentType?: string;
      }

      const dueTodayLoans: LoanInfo[] = [];
      const overdueLoans: LoanInfo[] = [];
      let totalToReceiveToday = 0;
      let totalOverdue = 0;

      for (const loan of loans || []) {
        const client = loan.clients as { full_name: string; phone: string | null };
        
        const installmentDates = (loan.installment_dates as string[]) || [];
        const numInstallments = loan.installments || 1;
        
        // USE DATABASE VALUES AS SOURCE OF TRUTH
        // total_interest from DB already includes user adjustments (rounding, renewal fees)
        let totalInterest = loan.total_interest || 0;
        if (totalInterest === 0) {
          // Fallback: calculate only if not stored
          if (loan.interest_mode === 'on_total') {
            totalInterest = loan.principal_amount * (loan.interest_rate / 100);
          } else if (loan.interest_mode === 'compound') {
            // Juros compostos: M = P(1+i)^n - P
            totalInterest = loan.principal_amount * Math.pow(1 + (loan.interest_rate / 100), numInstallments) - loan.principal_amount;
          } else {
            totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
          }
        }
        
        // remaining_balance from DB is the source of truth
        const remainingBalance = loan.remaining_balance;
        const totalToReceive = remainingBalance + (loan.total_paid || 0);
        
        const totalPerInstallment = totalToReceive / numInstallments;
        const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);

        let nextDueDate: string | null = null;
        let installmentAmount = totalPerInstallment;

        if (installmentDates.length > 0 && paidInstallments < installmentDates.length) {
          nextDueDate = installmentDates[paidInstallments];
        } else {
          nextDueDate = loan.due_date;
          if (loan.payment_type === 'single') {
            installmentAmount = remainingBalance;
          }
        }

        if (!nextDueDate) continue;

        const dueDate = new Date(nextDueDate);
        dueDate.setHours(0, 0, 0, 0);

        const loanInfo: LoanInfo = {
          id: loan.id,
          clientName: client.full_name,
          amount: installmentAmount,
          dueDate: nextDueDate,
          paymentType: loan.payment_type,
        };

        if (nextDueDate === todayStr) {
          dueTodayLoans.push(loanInfo);
          totalToReceiveToday += installmentAmount;
        } else if (dueDate < today) {
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          overdueLoans.push({
            ...loanInfo,
            daysOverdue,
          });
          totalOverdue += installmentAmount;
        }
      }

      // Categorize vehicles
      const dueTodayVehicles: any[] = [];
      const overdueVehicles: any[] = [];
      let vehicleTotalToday = 0;
      let vehicleTotalOverdue = 0;

      for (const payment of userVehiclePayments) {
        const vehicle = payment.vehicles as any;
        const paymentDueDate = new Date(payment.due_date);
        paymentDueDate.setHours(0, 0, 0, 0);

        const paymentInfo = {
          id: payment.id,
          vehicleName: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
          buyerName: vehicle.buyer_name || vehicle.seller_name,
          amount: payment.amount,
          installment: payment.installment_number,
          totalInstallments: vehicle.installments,
        };

        if (payment.due_date === todayStr) {
          dueTodayVehicles.push(paymentInfo);
          vehicleTotalToday += payment.amount;
        } else if (paymentDueDate < today) {
          const daysOverdue = Math.floor((today.getTime() - paymentDueDate.getTime()) / (1000 * 60 * 60 * 24));
          overdueVehicles.push({ ...paymentInfo, daysOverdue });
          vehicleTotalOverdue += payment.amount;
        }
      }

      // Categorize products
      const dueTodayProducts: any[] = [];
      const overdueProducts: any[] = [];
      let productTotalToday = 0;
      let productTotalOverdue = 0;

      for (const payment of userProductPayments) {
        const sale = payment.productSale as any;
        const paymentDueDate = new Date(payment.due_date);
        paymentDueDate.setHours(0, 0, 0, 0);

        const paymentInfo = {
          id: payment.id,
          productName: sale.product_name,
          clientName: sale.client_name,
          amount: payment.amount,
          installment: payment.installment_number,
          totalInstallments: sale.installments,
        };

        if (payment.due_date === todayStr) {
          dueTodayProducts.push(paymentInfo);
          productTotalToday += payment.amount;
        } else if (paymentDueDate < today) {
          const daysOverdue = Math.floor((today.getTime() - paymentDueDate.getTime()) / (1000 * 60 * 60 * 24));
          overdueProducts.push({ ...paymentInfo, daysOverdue });
          productTotalOverdue += payment.amount;
        }
      }

      // Sort overdue by days (most overdue first)
      overdueLoans.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
      overdueVehicles.sort((a, b) => b.daysOverdue - a.daysOverdue);
      overdueProducts.sort((a, b) => b.daysOverdue - a.daysOverdue);

      const totalDueToday = totalToReceiveToday + vehicleTotalToday + productTotalToday;
      const grandTotalOverdue = totalOverdue + vehicleTotalOverdue + productTotalOverdue;
      const hasDueToday = dueTodayLoans.length > 0 || dueTodayVehicles.length > 0 || dueTodayProducts.length > 0;
      const hasOverdue = overdueLoans.length > 0 || overdueVehicles.length > 0 || overdueProducts.length > 0;

      if (!hasDueToday && !hasOverdue) {
        console.log(`User ${profile.id} has no pending items, skipping`);
        continue;
      }

      // Build message - different header for report vs reminder
      let message = '';
      
      if (isReminder) {
        message += `🔔 *LEMBRETE DE COBRANÇAS - ${formatDate(today)}*\n`;
      } else {
        message += `📋 *RELATÓRIO DE COBRANÇAS - ${formatDate(today)}*\n`;
      }
      message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      // VENCE HOJE / AINDA PENDENTE HOJE
      if (hasDueToday) {
        if (isReminder) {
          message += `⏰ *AINDA PENDENTE HOJE:*\n\n`;
        } else {
          message += `⏰ *VENCE HOJE:*\n\n`;
        }

        if (dueTodayLoans.length > 0) {
          // Separar diários dos outros
          const dueTodayDailyLoans = dueTodayLoans.filter(l => l.paymentType === 'daily');
          const dueTodayOtherLoans = dueTodayLoans.filter(l => l.paymentType !== 'daily');

          if (dueTodayDailyLoans.length > 0) {
            message += `📅 *Diários (${dueTodayDailyLoans.length}):*\n`;
            dueTodayDailyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)}\n`;
            });
            message += `\n`;
          }

          if (dueTodayOtherLoans.length > 0) {
            message += `💰 *Empréstimos (${dueTodayOtherLoans.length}):*\n`;
            dueTodayOtherLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)}\n`;
            });
            message += `\n`;
          }
        }

        if (dueTodayVehicles.length > 0) {
          message += `🚗 *Veículos (${dueTodayVehicles.length}):*\n`;
          dueTodayVehicles.forEach(v => {
            message += `• ${v.buyerName} - ${v.vehicleName}: ${formatCurrency(v.amount)}\n`;
          });
          message += `\n`;
        }

        if (dueTodayProducts.length > 0) {
          message += `📦 *Produtos (${dueTodayProducts.length}):*\n`;
          dueTodayProducts.forEach(p => {
            message += `• ${p.clientName} - ${p.productName}: ${formatCurrency(p.amount)}\n`;
          });
          message += `\n`;
        }

        message += `💵 *Total Hoje: ${formatCurrency(totalDueToday)}*\n\n`;
      }

      // EM ATRASO
      if (hasOverdue) {
        message += `🚨 *EM ATRASO:*\n\n`;

        if (overdueLoans.length > 0) {
          // Separar diários dos outros
          const overdueDailyLoans = overdueLoans.filter(l => l.paymentType === 'daily');
          const overdueOtherLoans = overdueLoans.filter(l => l.paymentType !== 'daily');

          if (overdueDailyLoans.length > 0) {
            message += `📅 *Diários em Atraso (${overdueDailyLoans.length}):*\n`;
            overdueDailyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)} (${l.daysOverdue}d)\n`;
            });
            message += `\n`;
          }

          if (overdueOtherLoans.length > 0) {
            message += `💰 *Empréstimos em Atraso (${overdueOtherLoans.length}):*\n`;
            overdueOtherLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)} (${l.daysOverdue}d)\n`;
            });
            message += `\n`;
          }
        }

        if (overdueVehicles.length > 0) {
          message += `🚗 *Veículos em Atraso (${overdueVehicles.length}):*\n`;
          overdueVehicles.forEach(v => {
            message += `• ${v.buyerName} - ${v.vehicleName}: ${formatCurrency(v.amount)} (${v.daysOverdue}d)\n`;
          });
          message += `\n`;
        }

        if (overdueProducts.length > 0) {
          message += `📦 *Produtos em Atraso (${overdueProducts.length}):*\n`;
          overdueProducts.forEach(p => {
            message += `• ${p.clientName} - ${p.productName}: ${formatCurrency(p.amount)} (${p.daysOverdue}d)\n`;
          });
          message += `\n`;
        }

        message += `⚠️ *Total em Atraso: ${formatCurrency(grandTotalOverdue)}*\n\n`;
        message += `💡 _Para parar de receber alertas de atraso, registre os pagamentos ou dê baixa nos contratos no app._\n\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━━━\n`;
      if (isReminder) {
        message += `_CobraFácil - Lembrete às 12h_`;
      } else {
        message += `_CobraFácil - Relatório às 8h_`;
      }

      console.log(`Sending ${isReminder ? 'reminder' : 'report'} to user ${profile.id}`);
      
      const sent = await sendWhatsApp(profile.phone, message);
      if (sent) {
        sentCount++;
      }
    }

    console.log(`Sent ${sentCount} ${isReminder ? 'reminders' : 'reports'}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        usersChecked: profiles?.length || 0,
        type: isReminder ? 'reminder' : 'report'
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in daily-summary:", error);
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
