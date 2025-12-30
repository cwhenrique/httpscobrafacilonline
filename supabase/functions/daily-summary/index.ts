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
  // Usar instância fixa "VendaApp" para notificações do sistema
  const instanceName = "VendaApp";

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error("Missing Evolution API configuration");
    return false;
  }
  
  console.log("Using fixed system instance: VendaApp");

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
    // Parse request body to check if this is a reminder (12h) or report (7h), testPhone, and batch params
    let isReminder = false;
    let testPhone: string | null = null;
    let batch = 0;
    let batchSize = 3; // Reduzido para evitar timeout do pg_net (5s)
    try {
      const body = await req.json();
      isReminder = body.isReminder === true;
      testPhone = body.testPhone || null;
      batch = typeof body.batch === 'number' ? body.batch : 0;
      batchSize = typeof body.batchSize === 'number' ? body.batchSize : 3;
    } catch {
      // No body or invalid JSON, default to report mode
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Generating ${isReminder ? 'reminder (12h)' : 'report (7h)'} for:`, todayStr);
    console.log(`Batch: ${batch}, Batch size: ${batchSize}`);
    if (testPhone) {
      console.log("TEST MODE - sending only to:", testPhone);
    }

    // Get all ACTIVE PAYING users with phone configured - with pagination for batching
    // Excludes trial users - only sends to paying customers
    let profilesQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, subscription_plan')
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('subscription_plan', 'eq', 'trial') // Apenas usuários pagantes
      .order('id'); // Consistent ordering for batching
    
    console.log("Querying PAYING users only (excluding trial)");

    // Filter by testPhone if provided (ignores batch when testing)
    if (testPhone) {
      let cleanTestPhone = testPhone.replace(/\D/g, '');
      if (!cleanTestPhone.startsWith('55')) cleanTestPhone = '55' + cleanTestPhone;
      // Match last 9 digits
      profilesQuery = profilesQuery.ilike('phone', `%${cleanTestPhone.slice(-9)}%`);
    } else {
      // Apply pagination for batch processing
      const offset = batch * batchSize;
      profilesQuery = profilesQuery.range(offset, offset + batchSize - 1);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Processing ${profiles?.length || 0} users in batch ${batch}`);

    let sentCount = 0;

    for (const profile of profiles || []) {
      if (!profile.phone) continue;

      // ============= QUERIES PARALELAS PARA PERFORMANCE =============
      const [loansResult, loanPaymentsResult, vehiclePaymentsResult, productPaymentsResult] = await Promise.all([
        // EMPRÉSTIMOS
        supabase
          .from('loans')
          .select(`*, clients!inner(full_name, phone)`)
          .eq('user_id', profile.id)
          .in('status', ['pending', 'overdue']),
        // PAGAMENTOS DE EMPRÉSTIMOS (para contagem)
        supabase
          .from('loan_payments')
          .select('loan_id')
          .eq('user_id', profile.id),
        // VEÍCULOS
        supabase
          .from('vehicle_payments')
          .select(`*, vehicles!inner(brand, model, year, plate, buyer_name, seller_name, user_id, purchase_value, total_paid, installments)`)
          .eq('user_id', profile.id)
          .eq('status', 'pending')
          .gte('due_date', todayStr),
        // PRODUTOS
        supabase
          .from('product_sale_payments')
          .select(`*, productSale:product_sales!inner(product_name, client_name, user_id, total_amount, total_paid, installments)`)
          .eq('user_id', profile.id)
          .eq('status', 'pending')
          .gte('due_date', todayStr),
      ]);

      const loans = loansResult.data;
      const loanPaymentsData = loanPaymentsResult.data;
      const userVehiclePayments = vehiclePaymentsResult.data || [];
      const userProductPayments = productPaymentsResult.data || [];

      // Criar mapa de contagem de pagamentos por empréstimo
      const loanPaymentCounts: Record<string, number> = {};
      for (const payment of loanPaymentsData || []) {
        loanPaymentCounts[payment.loan_id] = (loanPaymentCounts[payment.loan_id] || 0) + 1;
      }

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
        let totalInterest = loan.total_interest || 0;
        if (totalInterest === 0) {
          if (loan.interest_mode === 'on_total') {
            totalInterest = loan.principal_amount * (loan.interest_rate / 100);
          } else if (loan.interest_mode === 'compound') {
            // Usar fórmula PMT de amortização (Sistema Price)
            const i = loan.interest_rate / 100;
            if (i === 0 || !isFinite(i)) {
              totalInterest = 0;
            } else {
              const factor = Math.pow(1 + i, numInstallments);
              const pmt = loan.principal_amount * (i * factor) / (factor - 1);
              totalInterest = (pmt * numInstallments) - loan.principal_amount;
            }
          } else {
            totalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
          }
        }
        
        const remainingBalance = loan.remaining_balance;
        const totalToReceive = remainingBalance + (loan.total_paid || 0);
        const totalPerInstallment = totalToReceive / numInstallments;
        
        // Usar contagem REAL de pagamentos em vez de dividir total_paid
        const paidInstallments = loanPaymentCounts[loan.id] || 0;

        // SPECIAL HANDLING FOR DAILY LOANS: Check ALL unpaid installments
        if (loan.payment_type === 'daily' && installmentDates.length > 0) {
          const dailyAmount = loan.total_interest || totalPerInstallment; // For daily, total_interest = daily amount
          
          // Iterate through all unpaid installments
          for (let i = paidInstallments; i < installmentDates.length; i++) {
            const installmentDate = installmentDates[i];
            const dueDate = new Date(installmentDate);
            dueDate.setHours(0, 0, 0, 0);
            
            const loanInfo: LoanInfo = {
              id: loan.id,
              clientName: client.full_name,
              amount: dailyAmount,
              dueDate: installmentDate,
              paymentType: loan.payment_type,
            };
            
            if (installmentDate === todayStr) {
              // Installment due TODAY
              dueTodayLoans.push(loanInfo);
              totalToReceiveToday += dailyAmount;
            } else if (dueDate < today) {
              // Installment OVERDUE
              const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              overdueLoans.push({ ...loanInfo, daysOverdue });
              totalOverdue += dailyAmount;
            }
            // Future installments are ignored
          }
        } else {
          // Standard logic for non-daily loans
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
            overdueLoans.push({ ...loanInfo, daysOverdue });
            totalOverdue += installmentAmount;
          }
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
        message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      } else {
        // Relatório das 7h: incluir bom dia
        message += `☀️ *Bom dia${profile.full_name ? `, ${profile.full_name}` : ''}!*\n\n`;
        message += `📋 *RELATÓRIO DO DIA - ${formatDate(today)}*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      }

      // VENCE HOJE / AINDA PENDENTE HOJE
      if (hasDueToday) {
        if (isReminder) {
          message += `⏰ *AINDA PENDENTE HOJE:*\n\n`;
        } else {
          message += `⏰ *VENCE HOJE:*\n\n`;
        }

        if (dueTodayLoans.length > 0) {
          // Separar por tipo de pagamento
          const dueTodayDailyLoans = dueTodayLoans.filter(l => l.paymentType === 'daily');
          const dueTodayWeeklyLoans = dueTodayLoans.filter(l => l.paymentType === 'weekly');
          const dueTodayBiweeklyLoans = dueTodayLoans.filter(l => l.paymentType === 'biweekly');
          // Mensais = tudo que não for diário, semanal ou quinzenal (inclui single e installment)
          const dueTodayMonthlyLoans = dueTodayLoans.filter(l => 
            l.paymentType !== 'daily' && l.paymentType !== 'weekly' && l.paymentType !== 'biweekly'
          );

          if (dueTodayDailyLoans.length > 0) {
            message += `📅 *Diários (${dueTodayDailyLoans.length}):*\n`;
            dueTodayDailyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)}\n`;
            });
            message += `\n`;
          }

          if (dueTodayWeeklyLoans.length > 0) {
            message += `📆 *Semanais (${dueTodayWeeklyLoans.length}):*\n`;
            dueTodayWeeklyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)}\n`;
            });
            message += `\n`;
          }

          if (dueTodayBiweeklyLoans.length > 0) {
            message += `📆 *Quinzenais (${dueTodayBiweeklyLoans.length}):*\n`;
            dueTodayBiweeklyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)}\n`;
            });
            message += `\n`;
          }

          if (dueTodayMonthlyLoans.length > 0) {
            message += `💰 *Mensais (${dueTodayMonthlyLoans.length}):*\n`;
            dueTodayMonthlyLoans.forEach(l => {
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
          // Separar por tipo de pagamento
          const overdueDailyLoans = overdueLoans.filter(l => l.paymentType === 'daily');
          const overdueWeeklyLoans = overdueLoans.filter(l => l.paymentType === 'weekly');
          const overdueBiweeklyLoans = overdueLoans.filter(l => l.paymentType === 'biweekly');
          // Mensais = tudo que não for diário, semanal ou quinzenal (inclui single e installment)
          const overdueMonthlyLoans = overdueLoans.filter(l => 
            l.paymentType !== 'daily' && l.paymentType !== 'weekly' && l.paymentType !== 'biweekly'
          );

          if (overdueDailyLoans.length > 0) {
            message += `📅 *Diários em Atraso (${overdueDailyLoans.length}):*\n`;
            overdueDailyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)} (${l.daysOverdue}d)\n`;
            });
            message += `\n`;
          }

          if (overdueWeeklyLoans.length > 0) {
            message += `📆 *Semanais em Atraso (${overdueWeeklyLoans.length}):*\n`;
            overdueWeeklyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)} (${l.daysOverdue}d)\n`;
            });
            message += `\n`;
          }

          if (overdueBiweeklyLoans.length > 0) {
            message += `📆 *Quinzenais em Atraso (${overdueBiweeklyLoans.length}):*\n`;
            overdueBiweeklyLoans.forEach(l => {
              message += `• ${l.clientName}: ${formatCurrency(l.amount)} (${l.daysOverdue}d)\n`;
            });
            message += `\n`;
          }

          if (overdueMonthlyLoans.length > 0) {
            message += `💰 *Mensais em Atraso (${overdueMonthlyLoans.length}):*\n`;
            overdueMonthlyLoans.forEach(l => {
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
        message += `_CobraFácil - Lembrete às 12h_\n\n`;
      } else {
        message += `_CobraFácil - Relatório Diário_\n\n`;
      }
      message += `📲 _Responda *OK* para continuar recebendo. Sem resposta, entendemos que prefere parar._`;

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
        type: isReminder ? 'reminder' : 'report',
        batch,
        batchSize
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
