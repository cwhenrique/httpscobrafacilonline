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

interface ProfileWithWhatsApp {
  id: string;
  phone: string;
  full_name: string | null;
  subscription_plan: string | null;
  whatsapp_instance_id: string | null;
  whatsapp_connected_phone: string | null;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  report_schedule_hours: number[] | null;
}

// Send WhatsApp message to user's own instance (self-message)
const sendWhatsAppToSelf = async (profile: ProfileWithWhatsApp, message: string): Promise<boolean> => {
  // Check if user has WhatsApp connected
  if (!profile.whatsapp_instance_id || !profile.whatsapp_connected_phone) {
    console.log(`User ${profile.id} has no WhatsApp connected, skipping`);
    return false;
  }

  // Use user's credentials or fallback to global
  const evolutionApiUrlRaw = profile.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = profile.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = profile.whatsapp_instance_id;

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error(`Missing Evolution API configuration for user ${profile.id}`);
    return false;
  }

  console.log(`Using user's own instance: ${instanceName}`);

  const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);

  // Clean the connected phone number
  let cleaned = profile.whatsapp_connected_phone.replace(/\D/g, '');
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

// Helper para extrair pagamentos parciais do notes do loan
const getPartialPaymentsFromNotes = (notes: string | null): Record<number, number> => {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("daily-summary function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to check if this is a reminder (12h) or report (7h), testPhone, targetHour, and batch params
    let isReminder = false;
    let testPhone: string | null = null;
    let targetHour: number | null = null;
    let batch = 0;
    let batchSize = 3; // Reduzido para evitar timeout do pg_net (5s)
    try {
      const body = await req.json();
      isReminder = body.isReminder === true;
      testPhone = body.testPhone || null;
      targetHour = typeof body.targetHour === 'number' ? body.targetHour : null;
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
    console.log(`Target hour: ${targetHour}, Batch: ${batch}, Batch size: ${batchSize}`);
    if (testPhone) {
      console.log("TEST MODE - sending only to:", testPhone);
    }

    // Get all ACTIVE PAYING users with WhatsApp connected
    let profilesQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, subscription_plan, whatsapp_instance_id, whatsapp_connected_phone, evolution_api_url, evolution_api_key, report_schedule_hours')
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('whatsapp_instance_id', 'is', null) // Only users with WhatsApp connected
      .not('whatsapp_connected_phone', 'is', null)
      .not('subscription_plan', 'eq', 'trial') // Only paying customers
      .order('id');
    
    console.log("Querying PAYING users with WhatsApp connected only");

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

    for (const profile of (profiles || []) as ProfileWithWhatsApp[]) {
      if (!profile.phone) continue;

      // If targetHour is specified (from cron), filter by user's scheduled hours
      // Users WITHOUT any schedule configured receive reports at default hours (8h and 12h)
      if (targetHour !== null && !testPhone) {
        const scheduleHours = profile.report_schedule_hours || [];
        const DEFAULT_HOURS = [8, 12];
        const effectiveHours = scheduleHours.length > 0 ? scheduleHours : DEFAULT_HOURS;
        if (!effectiveHours.includes(targetHour)) {
          console.log(`User ${profile.id} not subscribed to hour ${targetHour} (effective: ${effectiveHours.join(',')}), skipping`);
          continue;
        }
      }

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
        
        // Ler tags PARTIAL_PAID das notas para saber quais parcelas específicas foram pagas
        const partialPayments = getPartialPaymentsFromNotes(loan.notes);
        
        // Para diários, total_interest armazena o valor da parcela diária
        const installmentValue = loan.payment_type === 'daily' 
          ? (loan.total_interest || totalPerInstallment)
          : totalPerInstallment;

        // SPECIAL HANDLING FOR DAILY LOANS: Check ALL installments individually
        if (loan.payment_type === 'daily' && installmentDates.length > 0) {
          const dailyAmount = loan.total_interest || totalPerInstallment; // For daily, total_interest = daily amount
          
          // Iterate through ALL installments and check if each is paid
          for (let i = 0; i < installmentDates.length; i++) {
            // Verificar se esta parcela específica foi paga via tag PARTIAL_PAID
            const paidAmount = partialPayments[i] || 0;
            const isPaid = paidAmount >= dailyAmount * 0.99;
            
            if (isPaid) continue; // Parcela já paga, pular
            
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
          // Standard logic for non-daily loans: find first unpaid installment
          let nextDueDate: string | null = null;
          let installmentAmount = totalPerInstallment;

          // Encontrar a primeira parcela não paga
          let firstUnpaidIndex = -1;
          for (let i = 0; i < installmentDates.length; i++) {
            const paidAmount = partialPayments[i] || 0;
            const isPaid = paidAmount >= installmentValue * 0.99;
            if (!isPaid) {
              firstUnpaidIndex = i;
              break;
            }
          }

          if (firstUnpaidIndex >= 0 && firstUnpaidIndex < installmentDates.length) {
            nextDueDate = installmentDates[firstUnpaidIndex];
          } else if (loan.remaining_balance > 0) {
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
      interface VehicleInfo {
        id: string;
        vehicleName: string;
        buyerName: string;
        clientName: string;
        amount: number;
        installment: number;
        totalInstallments: number;
        daysOverdue?: number;
      }
      
      const dueTodayVehicles: VehicleInfo[] = [];
      const overdueVehicles: VehicleInfo[] = [];
      let vehicleTotalToday = 0;
      let vehicleTotalOverdue = 0;

      for (const payment of userVehiclePayments) {
        const vehicle = payment.vehicles as any;
        const paymentDueDate = new Date(payment.due_date);
        paymentDueDate.setHours(0, 0, 0, 0);

        const paymentInfo: VehicleInfo = {
          id: payment.id,
          vehicleName: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
          buyerName: vehicle.buyer_name || vehicle.seller_name,
          clientName: vehicle.buyer_name || vehicle.seller_name,
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
      interface ProductInfo {
        id: string;
        productName: string;
        clientName: string;
        amount: number;
        installment: number;
        totalInstallments: number;
        daysOverdue?: number;
      }
      
      const dueTodayProducts: ProductInfo[] = [];
      const overdueProducts: ProductInfo[] = [];
      let productTotalToday = 0;
      let productTotalOverdue = 0;

      for (const payment of userProductPayments) {
        const sale = payment.productSale as any;
        const paymentDueDate = new Date(payment.due_date);
        paymentDueDate.setHours(0, 0, 0, 0);

        const paymentInfo: ProductInfo = {
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
      overdueVehicles.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
      overdueProducts.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));

      const totalDueToday = totalToReceiveToday + vehicleTotalToday + productTotalToday;
      const grandTotalOverdue = totalOverdue + vehicleTotalOverdue + productTotalOverdue;
      const hasDueToday = dueTodayLoans.length > 0 || dueTodayVehicles.length > 0 || dueTodayProducts.length > 0;
      const hasOverdue = overdueLoans.length > 0 || overdueVehicles.length > 0 || overdueProducts.length > 0;

      if (!hasDueToday && !hasOverdue) {
        console.log(`User ${profile.id} has no pending items, skipping`);
        continue;
      }

      // Build text message with ALL clients (no limits)
      const titleText = isReminder 
        ? `🔔 *Lembrete de Cobranças*`
        : `📋 *Relatório do Dia*`;
      
      let messageText = `${titleText}\n\n`;
      messageText += `📅 ${formatDate(today)}\n`;
      messageText += `━━━━━━━━━━━━━━━━\n\n`;
      
      // VENCE HOJE - List ALL clients separated by category
      if (hasDueToday) {
        messageText += `⏰ *VENCE HOJE*\n`;
        messageText += `💵 Total: ${formatCurrency(totalDueToday)}\n\n`;
        
        // Separate loans by type
        const dueTodayDailyLoans = dueTodayLoans.filter(l => l.paymentType === 'daily');
        const dueTodayOtherLoans = dueTodayLoans.filter(l => l.paymentType !== 'daily');

        // DIÁRIOS - Separate section
        if (dueTodayDailyLoans.length > 0) {
          const dailyTotal = dueTodayDailyLoans.reduce((sum, l) => sum + l.amount, 0);
          messageText += `📅 *DIÁRIOS* (${dueTodayDailyLoans.length})\n`;
          dueTodayDailyLoans.forEach(l => {
            messageText += `• ${l.clientName}: ${formatCurrency(l.amount)}\n`;
          });
          messageText += `Subtotal: ${formatCurrency(dailyTotal)}\n\n`;
        }
        
        // OUTROS EMPRÉSTIMOS - Separate section
        if (dueTodayOtherLoans.length > 0) {
          const otherTotal = dueTodayOtherLoans.reduce((sum, l) => sum + l.amount, 0);
          messageText += `💰 *OUTROS EMPRÉSTIMOS* (${dueTodayOtherLoans.length})\n`;
          dueTodayOtherLoans.forEach(l => {
            const typeLabel = l.paymentType === 'weekly' ? 'sem' : 
                              l.paymentType === 'biweekly' ? 'quin' : 
                              l.paymentType === 'single' ? 'único' : 'mens';
            messageText += `• ${l.clientName} (${typeLabel}): ${formatCurrency(l.amount)}\n`;
          });
          messageText += `Subtotal: ${formatCurrency(otherTotal)}\n\n`;
        }
        
        // VEÍCULOS - Separate section
        if (dueTodayVehicles.length > 0) {
          const vehicleTotal = dueTodayVehicles.reduce((sum, v) => sum + v.amount, 0);
          messageText += `🚗 *VEÍCULOS* (${dueTodayVehicles.length})\n`;
          dueTodayVehicles.forEach(v => {
            messageText += `• ${v.buyerName}: ${formatCurrency(v.amount)}\n`;
          });
          messageText += `Subtotal: ${formatCurrency(vehicleTotal)}\n\n`;
        }
        
        // PRODUTOS - Separate section
        if (dueTodayProducts.length > 0) {
          const productTotal = dueTodayProducts.reduce((sum, p) => sum + p.amount, 0);
          messageText += `📦 *PRODUTOS* (${dueTodayProducts.length})\n`;
          dueTodayProducts.forEach(p => {
            messageText += `• ${p.clientName}: ${formatCurrency(p.amount)}\n`;
          });
          messageText += `Subtotal: ${formatCurrency(productTotal)}\n\n`;
        }
      }
      
      // EM ATRASO - Summary only (no individual listing)
      if (hasOverdue) {
        const totalOverdueClients = overdueLoans.length + overdueVehicles.length + overdueProducts.length;
        
        messageText += `🚨 *EM ATRASO*\n`;
        messageText += `👥 ${totalOverdueClients} cliente${totalOverdueClients > 1 ? 's' : ''} em atraso\n`;
        messageText += `💸 Total pendente: ${formatCurrency(grandTotalOverdue)}\n\n`;
      }
      
      messageText += `━━━━━━━━━━━━━━━━\n`;
      messageText += isReminder ? `CobraFácil - 12h` : `CobraFácil - 8h`;

      console.log(`Sending ${isReminder ? 'reminder' : 'report'} to user ${profile.id}`);
      
      const sent = await sendWhatsAppToSelf(profile, messageText);
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
