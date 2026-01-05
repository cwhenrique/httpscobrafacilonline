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

interface ListRow {
  title: string;
  description: string;
  rowId: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

interface ListData {
  title: string;
  description: string;
  buttonText: string;
  footerText: string;
  sections: ListSection[];
}

// Helper to truncate strings for API limits
const truncate = (str: string, max: number): string => 
  str.length > max ? str.substring(0, max - 3) + '...' : str;

const sendWhatsAppList = async (phone: string, listData: ListData): Promise<boolean> => {
  const evolutionApiUrlRaw = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = "notificacao";

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error("Missing Evolution API configuration");
    return false;
  }
  
  console.log("Using fixed system instance: notificacao");

  const evolutionApiUrl = cleanApiUrl(evolutionApiUrlRaw);

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  // Prepare sections with truncated values
  const preparedSections = listData.sections.slice(0, 10).map(section => ({
    title: truncate(section.title, 24),
    rows: section.rows.slice(0, 10).map(row => ({
      title: truncate(row.title, 24),
      description: truncate(row.description, 72),
      rowId: row.rowId,
    })),
  }));

  try {
    const response = await fetch(
      `${evolutionApiUrl}/message/sendList/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({
          number: cleaned,
          title: truncate(listData.title, 60),
          description: truncate(listData.description, 1024),
          buttonText: truncate(listData.buttonText, 20),
          footerText: truncate(listData.footerText, 60),
          sections: preparedSections,
        }),
      }
    );

    const data = await response.json();
    console.log(`WhatsApp LIST sent to ${cleaned}:`, data);
    
    if (!response.ok) {
      console.error("sendList failed, trying fallback text");
      // Fallback to text
      const fallbackMessage = `${listData.title}\n\n${listData.description}\n\n${listData.footerText}`;
      const textResponse = await fetch(
        `${evolutionApiUrl}/message/sendText/${instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiKey,
          },
          body: JSON.stringify({
            number: cleaned,
            text: fallbackMessage,
          }),
        }
      );
      return textResponse.ok;
    }
    
    return true;
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

      // Build list sections for interactive message
      const sections: ListSection[] = [];

      // VENCE HOJE section
      if (hasDueToday) {
        const dueTodayRows: ListRow[] = [];
        
        // Separate loans by type
        const dueTodayDailyLoans = dueTodayLoans.filter(l => l.paymentType === 'daily');
        const dueTodayWeeklyLoans = dueTodayLoans.filter(l => l.paymentType === 'weekly');
        const dueTodayBiweeklyLoans = dueTodayLoans.filter(l => l.paymentType === 'biweekly');
        const dueTodayMonthlyLoans = dueTodayLoans.filter(l => 
          l.paymentType !== 'daily' && l.paymentType !== 'weekly' && l.paymentType !== 'biweekly'
        );

        // Add daily loans
        dueTodayDailyLoans.slice(0, 3).forEach((l, idx) => {
          dueTodayRows.push({
            title: `📅 ${l.clientName}`,
            description: `Diário - ${formatCurrency(l.amount)}`,
            rowId: `due_daily_${idx}`,
          });
        });
        if (dueTodayDailyLoans.length > 3) {
          dueTodayRows.push({
            title: `📅 +${dueTodayDailyLoans.length - 3} diários`,
            description: `Ver mais no app`,
            rowId: `due_daily_more`,
          });
        }

        // Add weekly loans
        dueTodayWeeklyLoans.slice(0, 2).forEach((l, idx) => {
          dueTodayRows.push({
            title: `📆 ${l.clientName}`,
            description: `Semanal - ${formatCurrency(l.amount)}`,
            rowId: `due_weekly_${idx}`,
          });
        });

        // Add monthly loans
        dueTodayMonthlyLoans.slice(0, 3).forEach((l, idx) => {
          dueTodayRows.push({
            title: `💰 ${l.clientName}`,
            description: `Mensal - ${formatCurrency(l.amount)}`,
            rowId: `due_monthly_${idx}`,
          });
        });

        // Add vehicles
        dueTodayVehicles.slice(0, 2).forEach((v, idx) => {
          dueTodayRows.push({
            title: `🚗 ${v.buyerName}`,
            description: `${v.vehicleName} - ${formatCurrency(v.amount)}`,
            rowId: `due_vehicle_${idx}`,
          });
        });

        // Add products
        dueTodayProducts.slice(0, 2).forEach((p, idx) => {
          dueTodayRows.push({
            title: `📦 ${p.clientName}`,
            description: `${p.productName} - ${formatCurrency(p.amount)}`,
            rowId: `due_product_${idx}`,
          });
        });

        if (dueTodayRows.length > 0) {
          sections.push({
            title: `⏰ Vence Hoje (${formatCurrency(totalDueToday)})`,
            rows: dueTodayRows.slice(0, 10),
          });
        }
      }

      // EM ATRASO section
      if (hasOverdue) {
        const overdueRows: ListRow[] = [];
        
        // Separate loans by type
        const overdueDailyLoans = overdueLoans.filter(l => l.paymentType === 'daily');
        const overdueMonthlyLoans = overdueLoans.filter(l => 
          l.paymentType !== 'daily' && l.paymentType !== 'weekly' && l.paymentType !== 'biweekly'
        );

        // Add daily overdue (most critical)
        overdueDailyLoans.slice(0, 3).forEach((l, idx) => {
          overdueRows.push({
            title: `📅 ${l.clientName}`,
            description: `${l.daysOverdue}d atraso - ${formatCurrency(l.amount)}`,
            rowId: `overdue_daily_${idx}`,
          });
        });
        if (overdueDailyLoans.length > 3) {
          overdueRows.push({
            title: `📅 +${overdueDailyLoans.length - 3} diários`,
            description: `Atrasados - ver no app`,
            rowId: `overdue_daily_more`,
          });
        }

        // Add monthly overdue
        overdueMonthlyLoans.slice(0, 3).forEach((l, idx) => {
          overdueRows.push({
            title: `💰 ${l.clientName}`,
            description: `${l.daysOverdue}d - ${formatCurrency(l.amount)}`,
            rowId: `overdue_monthly_${idx}`,
          });
        });

        // Add vehicles
        overdueVehicles.slice(0, 2).forEach((v, idx) => {
          overdueRows.push({
            title: `🚗 ${v.buyerName}`,
            description: `${v.daysOverdue}d - ${formatCurrency(v.amount)}`,
            rowId: `overdue_vehicle_${idx}`,
          });
        });

        // Add products
        overdueProducts.slice(0, 2).forEach((p, idx) => {
          overdueRows.push({
            title: `📦 ${p.clientName}`,
            description: `${p.daysOverdue}d - ${formatCurrency(p.amount)}`,
            rowId: `overdue_product_${idx}`,
          });
        });

        if (overdueRows.length > 0) {
          sections.push({
            title: `🚨 Em Atraso (${formatCurrency(grandTotalOverdue)})`,
            rows: overdueRows.slice(0, 10),
          });
        }
      }

      // Build list data with DETAILED description
      const titleText = isReminder 
        ? `🔔 Lembrete de Cobranças`
        : `📋 Relatório do Dia`;
      
      // Build a rich description with all the important info upfront
      let descriptionText = `📅 ${formatDate(today)}\n`;
      descriptionText += `━━━━━━━━━━━━━━━━\n\n`;
      
      if (hasDueToday) {
        descriptionText += `⏰ *VENCE HOJE*\n`;
        descriptionText += `💵 Total: ${formatCurrency(totalDueToday)}\n`;
        descriptionText += `📊 ${dueTodayLoans.length} empréstimo${dueTodayLoans.length !== 1 ? 's' : ''}`;
        if (dueTodayVehicles.length > 0) descriptionText += `, ${dueTodayVehicles.length} veículo${dueTodayVehicles.length !== 1 ? 's' : ''}`;
        if (dueTodayProducts.length > 0) descriptionText += `, ${dueTodayProducts.length} produto${dueTodayProducts.length !== 1 ? 's' : ''}`;
        descriptionText += `\n\n`;
        
        // List top 3 clients with amounts
        const topDueToday = [...dueTodayLoans, ...dueTodayVehicles.map(v => ({clientName: v.buyerName, amount: v.amount})), ...dueTodayProducts].slice(0, 3);
        topDueToday.forEach(item => {
          descriptionText += `• ${item.clientName}: ${formatCurrency(item.amount)}\n`;
        });
        if (dueTodayLoans.length + dueTodayVehicles.length + dueTodayProducts.length > 3) {
          descriptionText += `  (+${dueTodayLoans.length + dueTodayVehicles.length + dueTodayProducts.length - 3} mais)\n`;
        }
        descriptionText += `\n`;
      }
      
      if (hasOverdue) {
        descriptionText += `🚨 *EM ATRASO*\n`;
        descriptionText += `💸 Total: ${formatCurrency(grandTotalOverdue)}\n`;
        descriptionText += `📊 ${overdueLoans.length} empréstimo${overdueLoans.length !== 1 ? 's' : ''}`;
        if (overdueVehicles.length > 0) descriptionText += `, ${overdueVehicles.length} veículo${overdueVehicles.length !== 1 ? 's' : ''}`;
        if (overdueProducts.length > 0) descriptionText += `, ${overdueProducts.length} produto${overdueProducts.length !== 1 ? 's' : ''}`;
        descriptionText += `\n\n`;
        
        // List top 3 overdue with days
        const topOverdue = [...overdueLoans, ...overdueVehicles, ...overdueProducts].slice(0, 3);
        topOverdue.forEach(item => {
          descriptionText += `• ${item.clientName}: ${formatCurrency(item.amount)} (${item.daysOverdue}d)\n`;
        });
        if (overdueLoans.length + overdueVehicles.length + overdueProducts.length > 3) {
          descriptionText += `  (+${overdueLoans.length + overdueVehicles.length + overdueProducts.length - 3} mais)\n`;
        }
        descriptionText += `\n`;
      }
      
      descriptionText += `━━━━━━━━━━━━━━━━\n`;
      descriptionText += `Clique no botão abaixo para ver a lista completa de clientes.`;

      const listData: ListData = {
        title: titleText,
        description: descriptionText,
        buttonText: "📋 Ver Clientes",
        footerText: isReminder ? "CobraFácil - 12h" : "CobraFácil",
        sections: sections,
      };

      console.log(`Sending ${isReminder ? 'reminder' : 'report'} LIST to user ${profile.id}`);
      
      const sent = await sendWhatsAppList(profile.phone, listData);
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
