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

const getWeekdayName = (date: Date): string => {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[date.getDay()];
};

const getPaymentTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    installment: 'Mensal',
    single: 'Único',
  };
  return labels[type] || 'Mensal';
};

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
};

interface ProfileWithWhatsApp {
  id: string;
  phone: string;
  full_name: string | null;
  subscription_plan: string | null;
  whatsapp_instance_token: string | null;
  whatsapp_connected_phone: string | null;
  report_schedule_hours: number[] | null;
  relatorio_ativo: boolean;
}

// Send WhatsApp message via Um Clique Digital API (Official WhatsApp partner)
// Always saves to pending_messages and sends template for user confirmation
const sendWhatsAppViaUmClique = async (phone: string, userName: string, message: string, userId: string, supabase: any): Promise<boolean> => {
  const umcliqueApiKey = Deno.env.get("UMCLIQUE_API_KEY");
  if (!umcliqueApiKey) {
    console.error("UMCLIQUE_API_KEY not configured");
    return false;
  }

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  const apiUrl = 'https://cslsnijdeayzfpmwjtmw.supabase.co/functions/v1/public-send-message';
  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": umcliqueApiKey,
  };

  try {

    // NORMAL MODE: Save to pending and send template for confirmation
    // Check for existing pending message today (BRT timezone = UTC-3) to prevent duplicate templates
    // Use BRT midnight to avoid timezone issues where UTC midnight = 21h BRT previous day
    const now = new Date();
    const brtOffset = -3 * 60; // BRT is UTC-3
    const brtNow = new Date(now.getTime() + brtOffset * 60 * 1000);
    const brtTodayStart = new Date(brtNow);
    brtTodayStart.setHours(0, 0, 0, 0);
    // Convert BRT midnight back to UTC for the query
    const todayStartUTC = new Date(brtTodayStart.getTime() - brtOffset * 60 * 1000);

    const { data: existing } = await supabase
      .from('pending_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('message_type', 'daily_report')
      .gte('created_at', todayStartUTC.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Skipping duplicate template for user ${userId} - already sent today (BRT). Cutoff: ${todayStartUTC.toISOString()}`);
      return true;
    }

    // Save report content to pending_messages so webhook can deliver on confirmation
    const { error: pendingError } = await supabase
      .from('pending_messages')
      .insert({
        user_id: userId,
        client_phone: cleaned,
        client_name: userName,
        message_type: 'daily_report',
        message_content: message,
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    
    if (pendingError) {
      console.error(`Failed to save pending message for ${cleaned}:`, pendingError);
    } else {
      console.log(`Saved report to pending_messages for ${cleaned}`);
    }

    // Send template to prompt user to confirm
    console.log(`Sending template 'relatorio' to ${cleaned} for user ${userName}`);
    const templateResponse = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel_id: "1060061327180048",
        to: cleaned,
        type: "template",
        template_name: "relatorio",
        template_language: "pt_BR",
        template_variables: [
          { type: "text", text: userName }
        ],
      }),
    });

    const templateResult = await templateResponse.text();
    console.log(`Template response for ${cleaned}:`, templateResponse.status, templateResult);

    if (!templateResponse.ok) {
      console.error(`Failed to send template to ${cleaned}:`, templateResult);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Failed to send via Um Clique API to ${cleaned}:`, error);
    return false;
  }
};

// Send WhatsApp message to user's own instance via UAZAPI
const sendWhatsAppToSelf = async (profile: ProfileWithWhatsApp, message: string): Promise<boolean> => {
  if (!profile.whatsapp_instance_token || !profile.whatsapp_connected_phone) {
    console.log(`User ${profile.id} has no WhatsApp connected, skipping`);
    return false;
  }
  const uazapiUrl = Deno.env.get("UAZAPI_URL");
  if (!uazapiUrl) return false;
  const formattedPhone = formatPhoneNumber(profile.whatsapp_connected_phone);
  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": profile.whatsapp_instance_token },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });
    console.log(`WhatsApp sent to ${formattedPhone}: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${formattedPhone}:`, error);
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
    let batchSize = 30; // Otimizado: batch maior para reduzir número de cron jobs
    
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
      .select('id, phone, full_name, subscription_plan, whatsapp_instance_token, whatsapp_connected_phone, report_schedule_hours, relatorio_ativo')
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('subscription_plan', 'eq', 'trial')
      .or('whatsapp_instance_token.not.is.null,relatorio_ativo.eq.true')
      .order('id');
    
    console.log("Querying PAYING users with WhatsApp connected OR relatorio_ativo");

    // Filter by testPhone if provided (ignores batch when testing)
    if (testPhone) {
      let cleanTestPhone = testPhone.replace(/\D/g, '');
      if (!cleanTestPhone.startsWith('55')) cleanTestPhone = '55' + cleanTestPhone;
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
          console.log(`User ${profile.id} skipped - hour ${targetHour} not in [${effectiveHours.join(',')}]`);
          continue;
        }
        console.log(`User ${profile.id} matched hour ${targetHour} (schedule: [${effectiveHours.join(',')}])`);
      }

      // ============= QUERIES PARALELAS PARA PERFORMANCE =============
      const [loansResult, loanPaymentsResult, vehiclePaymentsResult, productPaymentsResult, contractPaymentsResult] = await Promise.all([
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
          .eq('status', 'pending'),
        // PRODUTOS
        supabase
          .from('product_sale_payments')
          .select(`*, productSale:product_sales!inner(product_name, client_name, user_id, total_amount, total_paid, installments)`)
          .eq('user_id', profile.id)
          .eq('status', 'pending'),
        // CONTRATOS
        supabase
          .from('contract_payments')
          .select(`*, contract:contracts!inner(client_name, contract_type, installments)`)
          .eq('user_id', profile.id)
          .eq('status', 'pending'),
      ]);

      const loans = loansResult.data;
      const loanPaymentsData = loanPaymentsResult.data;
      const userVehiclePayments = vehiclePaymentsResult.data || [];
      const userProductPayments = productPaymentsResult.data || [];
      const userContractPayments = contractPaymentsResult.data || [];

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
        installmentNumber?: number;
        totalInstallments?: number;
        paymentTypeLabel?: string;
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
              installmentNumber: i + 1,
              totalInstallments: installmentDates.length,
              paymentTypeLabel: getPaymentTypeLabel(loan.payment_type),
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
            installmentNumber: firstUnpaidIndex >= 0 ? firstUnpaidIndex + 1 : 1,
            totalInstallments: numInstallments,
            paymentTypeLabel: getPaymentTypeLabel(loan.payment_type),
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

      // Categorize contracts
      interface ContractInfo {
        id: string;
        clientName: string;
        contractType: string;
        amount: number;
        installment: number;
        totalInstallments: number;
        daysOverdue?: number;
      }

      const dueTodayContracts: ContractInfo[] = [];
      const overdueContracts: ContractInfo[] = [];
      let contractTotalToday = 0;
      let contractTotalOverdue = 0;

      for (const payment of userContractPayments) {
        const contract = payment.contract as any;
        const paymentDueDate = new Date(payment.due_date);
        paymentDueDate.setHours(0, 0, 0, 0);

        const paymentInfo: ContractInfo = {
          id: payment.id,
          clientName: contract.client_name,
          contractType: contract.contract_type || 'Contrato',
          amount: payment.amount,
          installment: payment.installment_number,
          totalInstallments: contract.installments,
        };

        if (payment.due_date === todayStr) {
          dueTodayContracts.push(paymentInfo);
          contractTotalToday += payment.amount;
        } else if (paymentDueDate < today) {
          const daysOverdue = Math.floor((today.getTime() - paymentDueDate.getTime()) / (1000 * 60 * 60 * 24));
          overdueContracts.push({ ...paymentInfo, daysOverdue });
          contractTotalOverdue += payment.amount;
        }
      }

      // Sort overdue by days (most overdue first)
      overdueLoans.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
      overdueVehicles.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
      overdueProducts.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
      overdueContracts.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));

      const totalDueToday = totalToReceiveToday + vehicleTotalToday + productTotalToday + contractTotalToday;
      const grandTotalOverdue = totalOverdue + vehicleTotalOverdue + productTotalOverdue + contractTotalOverdue;
      const hasDueToday = dueTodayLoans.length > 0 || dueTodayVehicles.length > 0 || dueTodayProducts.length > 0 || dueTodayContracts.length > 0;
      const hasOverdue = overdueLoans.length > 0 || overdueVehicles.length > 0 || overdueProducts.length > 0 || overdueContracts.length > 0;
      const totalDueTodayCount = dueTodayLoans.length + dueTodayVehicles.length + dueTodayProducts.length + dueTodayContracts.length;
      const totalOverdueCount = overdueLoans.length + overdueVehicles.length + overdueProducts.length + overdueContracts.length;

      if (!hasDueToday && !hasOverdue) {
        console.log(`User ${profile.id} has no pending items, skipping`);
        continue;
      }

      // Portfolio metrics
      const activeLoansCount = (loans || []).filter(l => l.status !== 'paid').length;
      const activeClientIds = new Set((loans || []).filter(l => l.status !== 'paid').map(l => l.client_id));
      const capitalNaRua = (loans || []).filter(l => l.status !== 'paid').reduce((sum, l) => sum + l.remaining_balance, 0);
      const activeContractsCount = new Set(userContractPayments.map((p: any) => p.contract_id)).size;

      // Build executive report message
      const displayHour = targetHour !== null ? targetHour : 8;
      let messageText = `📊 *RELATÓRIO COBRAFÁCIL*\n`;
      messageText += `📅 ${formatDate(today)} • ${getWeekdayName(today)}\n\n`;
      messageText += `━━━━━━━━━━━━━━━━━━━\n\n`;

      // RESUMO DO DIA
      messageText += `💰 *RESUMO DO DIA*\n`;
      if (hasDueToday) {
        messageText += `▸ A cobrar hoje: ${formatCurrency(totalDueToday)} (${totalDueTodayCount} parcela${totalDueTodayCount > 1 ? 's' : ''})\n`;
      }
      if (hasOverdue) {
        messageText += `▸ Em atraso: ${formatCurrency(grandTotalOverdue)} (${totalOverdueCount} parcela${totalOverdueCount > 1 ? 's' : ''})\n`;
      }
      messageText += `▸ Total pendente: ${formatCurrency(totalDueToday + grandTotalOverdue)}\n\n`;
      messageText += `━━━━━━━━━━━━━━━━━━━\n\n`;

      // VENCE HOJE
      if (hasDueToday) {
        messageText += `⏰ *VENCE HOJE* — ${formatCurrency(totalDueToday)}\n\n`;

        // Empréstimos
        if (dueTodayLoans.length > 0) {
          messageText += `💵 Empréstimos (${dueTodayLoans.length})\n`;
          dueTodayLoans.forEach(l => {
            messageText += `• ${l.clientName} — ${formatCurrency(l.amount)}\n`;
            const installmentInfo = l.totalInstallments && l.totalInstallments > 1
              ? ` • Parcela ${l.installmentNumber}/${l.totalInstallments}`
              : '';
            messageText += `  ↳ ${l.paymentTypeLabel || 'Mensal'}${installmentInfo}\n`;
          });
          messageText += `\n`;
        }

        // Contratos
        if (dueTodayContracts.length > 0) {
          messageText += `📄 Contratos (${dueTodayContracts.length})\n`;
          dueTodayContracts.forEach(c => {
            messageText += `• ${c.clientName} — ${formatCurrency(c.amount)}\n`;
            messageText += `  ↳ ${c.contractType} • Parcela ${c.installment}/${c.totalInstallments}\n`;
          });
          messageText += `\n`;
        }

        // Veículos
        if (dueTodayVehicles.length > 0) {
          messageText += `🚗 Veículos (${dueTodayVehicles.length})\n`;
          dueTodayVehicles.forEach(v => {
            messageText += `• ${v.buyerName} — ${formatCurrency(v.amount)}\n`;
            messageText += `  ↳ ${v.vehicleName} • Parcela ${v.installment}/${v.totalInstallments}\n`;
          });
          messageText += `\n`;
        }

        // Produtos
        if (dueTodayProducts.length > 0) {
          messageText += `📦 Produtos (${dueTodayProducts.length})\n`;
          dueTodayProducts.forEach(p => {
            messageText += `• ${p.clientName} — ${formatCurrency(p.amount)}\n`;
            messageText += `  ↳ ${p.productName} • Parcela ${p.installment}/${p.totalInstallments}\n`;
          });
          messageText += `\n`;
        }

        messageText += `━━━━━━━━━━━━━━━━━━━\n\n`;
      }

      // EM ATRASO - Detailed per client with days
      if (hasOverdue) {
        messageText += `🚨 *EM ATRASO* — ${formatCurrency(grandTotalOverdue)}\n\n`;

        // Empréstimos atrasados
        if (overdueLoans.length > 0) {
          messageText += `💵 Empréstimos (${overdueLoans.length})\n`;
          overdueLoans.forEach(l => {
            messageText += `• ${l.clientName} — ${formatCurrency(l.amount)}\n`;
            const installmentInfo = l.totalInstallments && l.totalInstallments > 1
              ? ` • Parcela ${l.installmentNumber}/${l.totalInstallments}`
              : '';
            messageText += `  ↳ ${l.daysOverdue} dia${(l.daysOverdue || 0) > 1 ? 's' : ''} de atraso • ${l.paymentTypeLabel || 'Mensal'}${installmentInfo}\n`;
          });
          messageText += `\n`;
        }

        // Contratos atrasados
        if (overdueContracts.length > 0) {
          messageText += `📄 Contratos (${overdueContracts.length})\n`;
          overdueContracts.forEach(c => {
            messageText += `• ${c.clientName} — ${formatCurrency(c.amount)}\n`;
            messageText += `  ↳ ${c.daysOverdue} dia${(c.daysOverdue || 0) > 1 ? 's' : ''} de atraso • ${c.contractType} • Parcela ${c.installment}/${c.totalInstallments}\n`;
          });
          messageText += `\n`;
        }

        // Veículos atrasados
        if (overdueVehicles.length > 0) {
          messageText += `🚗 Veículos (${overdueVehicles.length})\n`;
          overdueVehicles.forEach(v => {
            messageText += `• ${v.buyerName} — ${formatCurrency(v.amount)}\n`;
            messageText += `  ↳ ${v.daysOverdue} dia${(v.daysOverdue || 0) > 1 ? 's' : ''} de atraso • ${v.vehicleName} • Parcela ${v.installment}/${v.totalInstallments}\n`;
          });
          messageText += `\n`;
        }

        // Produtos atrasados
        if (overdueProducts.length > 0) {
          messageText += `📦 Produtos (${overdueProducts.length})\n`;
          overdueProducts.forEach(p => {
            messageText += `• ${p.clientName} — ${formatCurrency(p.amount)}\n`;
            messageText += `  ↳ ${p.daysOverdue} dia${(p.daysOverdue || 0) > 1 ? 's' : ''} de atraso • ${p.productName} • Parcela ${p.installment}/${p.totalInstallments}\n`;
          });
          messageText += `\n`;
        }

        messageText += `━━━━━━━━━━━━━━━━━━━\n\n`;
      }

      // SUA CARTEIRA
      messageText += `📈 *SUA CARTEIRA*\n`;
      messageText += `▸ Clientes ativos: ${activeClientIds.size}\n`;
      messageText += `▸ Empréstimos ativos: ${activeLoansCount}\n`;
      if (activeContractsCount > 0) {
        messageText += `▸ Contratos ativos: ${activeContractsCount}\n`;
      }
      messageText += `▸ Capital na rua: ${formatCurrency(capitalNaRua)}\n\n`;
      messageText += `━━━━━━━━━━━━━━━━━━━\n`;
      messageText += `CobraFácil • ${displayHour}h`;

      console.log(`Sending ${isReminder ? 'reminder' : 'report'} to user ${profile.id} (relatorio_ativo: ${profile.relatorio_ativo})`);
      
      // Route: relatorio_ativo users go via Um Clique Digital API, others via UAZAPI
      const sent = profile.relatorio_ativo
        ? await sendWhatsAppViaUmClique(profile.phone, profile.full_name || 'Cliente', messageText, profile.id, supabase)
        : await sendWhatsAppToSelf(profile, messageText);
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
