import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
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

const generateProgressBar = (progressPercent: number): string => {
  const filledBlocks = Math.round(progressPercent / 10);
  const emptyBlocks = 10 - filledBlocks;
  return `${'▓'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progressPercent}%`;
};

const getPixKeyTypeLabel = (type: string | null): string => {
  switch (type) {
    case 'cpf': return 'Chave PIX CPF';
    case 'cnpj': return 'Chave PIX CNPJ';
    case 'telefone': return 'Chave PIX Telefone';
    case 'email': return 'Chave PIX Email';
    case 'aleatoria': return 'Chave PIX Aleatória';
    default: return 'Chave PIX';
  }
};

// Default templates (mirrored from client-side)
const DEFAULT_TEMPLATE_OVERDUE = `⚠️ *Atenção {CLIENTE}*
━━━━━━━━━━━━━━━━

🚨 *PARCELA EM ATRASO*

💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* {DATA}
⏰ *Dias em Atraso:* {DIAS_ATRASO}
{MULTA}{JUROS}{TOTAL}

{PROGRESSO}

{PIX}

{FECHAMENTO}
{ASSINATURA}`;

const DEFAULT_TEMPLATE_DUE_TODAY = `Olá *{CLIENTE}*!
━━━━━━━━━━━━━━━━

📅 *VENCIMENTO HOJE*

💵 *Valor:* {VALOR}
📊 *{PARCELA}*
📅 *Vencimento:* Hoje ({DATA})

{PROGRESSO}

{PIX}

Evite juros e multas pagando em dia!

{FECHAMENTO}
{ASSINATURA}`;

interface TemplateData {
  clientName: string;
  amount: number;
  installmentNumber?: number;
  totalInstallments?: number;
  dueDate: string;
  daysOverdue?: number;
  progressPercent?: number;
  pixKey?: string | null;
  pixKeyType?: string | null;
  pixPreMessage?: string | null;
  signatureName?: string | null;
}

const replaceTemplateVariables = (template: string, data: TemplateData): string => {
  const parcela = data.installmentNumber && data.totalInstallments
    ? `Parcela ${data.installmentNumber}/${data.totalInstallments}`
    : 'Pagamento';

  const progressBar = data.progressPercent !== undefined
    ? `📈 *Progresso:* ${generateProgressBar(data.progressPercent)}`
    : '';

  let pixSection = '';
  if (data.pixKey) {
    pixSection = `━━━━━━━━━━━━━━━━\n`;
    if (data.pixPreMessage?.trim()) {
      pixSection += `📢 ${data.pixPreMessage.trim()}\n\n`;
    }
    pixSection += `💳 *${getPixKeyTypeLabel(data.pixKeyType || null)}:* ${data.pixKey}\n`;
  }

  const signature = data.signatureName ? `\n━━━━━━━━━━━━━━━━\n_${data.signatureName}_` : '';

  return template
    .replace(/\{CLIENTE\}/g, data.clientName)
    .replace(/\{VALOR\}/g, formatCurrency(data.amount))
    .replace(/\{PARCELA\}/g, parcela)
    .replace(/\{DATA\}/g, formatDate(data.dueDate))
    .replace(/\{DIAS_ATRASO\}/g, String(data.daysOverdue || 0))
    .replace(/\{DIAS_PARA_VENCER\}/g, '0')
    .replace(/\{MULTA\}/g, '')
    .replace(/\{JUROS\}/g, '')
    .replace(/\{JUROS_MULTA\}/g, '')
    .replace(/\{TOTAL\}/g, '')
    .replace(/\{PROGRESSO\}/g, progressBar)
    .replace(/\{PIX\}/g, pixSection)
    .replace(/\{ASSINATURA\}/g, signature)
    .replace(/\{FECHAMENTO\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Helper to extract partial payments from loan notes
const getPartialPaymentsFromNotes = (notes: string | null): Record<number, number> => {
  const payments: Record<number, number> = {};
  const matches = (notes || '').matchAll(/\[PARTIAL_PAID:(\d+):([0-9.]+)\]/g);
  for (const match of matches) {
    payments[parseInt(match[1])] = parseFloat(match[2]);
  }
  return payments;
};

interface ClientBillingItem {
  clientName: string;
  clientPhone: string;
  amount: number;
  dueDate: string;
  installmentNumber: number;
  totalInstallments: number;
  progressPercent: number;
  type: 'due_today' | 'overdue';
  daysOverdue?: number;
  contractType: 'loan' | 'vehicle' | 'product';
  contractId: string;
}

const sendWhatsAppToClient = async (
  evolutionApiUrl: string,
  evolutionApiKey: string,
  instanceName: string,
  phone: string,
  message: string
): Promise<boolean> => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  if (cleaned.length < 10) {
    console.log(`Invalid phone number: ${cleaned}, skipping`);
    return false;
  }

  try {
    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({ number: cleaned, text: message }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Failed to send to ${cleaned}: ${response.status} ${errText}`);
      return false;
    }

    console.log(`Message sent to ${cleaned}`);
    return true;
  } catch (error) {
    console.error(`Error sending to ${cleaned}:`, error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("auto-client-billing function called at", new Date().toISOString());

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let targetHour: number | null = null;
    let batch = 0;
    let batchSize = 3;
    let testUserId: string | null = null;

    try {
      const body = await req.json();
      targetHour = typeof body.targetHour === 'number' ? body.targetHour : null;
      batch = typeof body.batch === 'number' ? body.batch : 0;
      batchSize = typeof body.batchSize === 'number' ? body.batchSize : 3;
      testUserId = body.testUserId || null;
    } catch { /* no body */ }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawEvolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!rawEvolutionApiUrl || !evolutionApiKey) {
      throw new Error("Missing Evolution API configuration");
    }

    const urlMatch = rawEvolutionApiUrl.match(/^(https?:\/\/[^\/]+)/);
    const evolutionApiUrl = urlMatch ? urlMatch[1] : cleanApiUrl(rawEvolutionApiUrl);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Check day of week - skip Sundays (0 = Sunday)
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 && !testUserId) {
      console.log("Sunday - skipping auto billing");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'sunday' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get eligible users
    let profilesQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, subscription_plan, whatsapp_instance_id, whatsapp_connected_phone, whatsapp_to_clients_enabled, evolution_api_url, evolution_api_key, auto_client_reports_enabled, auto_report_hour, auto_report_types, pix_key, pix_key_type, pix_pre_message, billing_signature_name, billing_message_config')
      .eq('is_active', true)
      .eq('auto_client_reports_enabled', true)
      .not('whatsapp_instance_id', 'is', null)
      .not('whatsapp_connected_phone', 'is', null)
      .not('subscription_plan', 'eq', 'trial')
      .order('id');

    if (testUserId) {
      profilesQuery = profilesQuery.eq('id', testUserId);
    } else {
      const offset = batch * batchSize;
      profilesQuery = profilesQuery.range(offset, offset + batchSize - 1);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;
    if (profilesError) throw profilesError;

    console.log(`Processing ${profiles?.length || 0} users (batch ${batch})`);

    let totalSent = 0;
    let totalSkipped = 0;

    for (const profile of profiles || []) {
      // Filter by target hour
      if (targetHour !== null && !testUserId) {
        const userHour = profile.auto_report_hour || 8;
        if (userHour !== targetHour) {
          console.log(`User ${profile.id} configured for hour ${userHour}, skipping (target: ${targetHour})`);
          continue;
        }
      }

      if (!profile.whatsapp_to_clients_enabled) {
        console.log(`User ${profile.id} has WhatsApp to clients disabled, skipping`);
        continue;
      }

      const instanceName = profile.whatsapp_instance_id;
      const userReportTypes: string[] = profile.auto_report_types || ['due_today', 'overdue'];

      // Get billing config
      const billingConfig = profile.billing_message_config as any || {};
      const useCustom = billingConfig?.useCustomTemplates === true;
      const templateOverdue = useCustom && billingConfig?.customTemplateOverdue ? billingConfig.customTemplateOverdue : DEFAULT_TEMPLATE_OVERDUE;
      const templateDueToday = useCustom && billingConfig?.customTemplateDueToday ? billingConfig.customTemplateDueToday : DEFAULT_TEMPLATE_DUE_TODAY;

      // Collect all billing items for this user
      const billingItems: ClientBillingItem[] = [];

      // === LOANS ===
      const { data: loans } = await supabase
        .from('loans')
        .select('*, clients!inner(full_name, phone)')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'overdue']);

      for (const loan of loans || []) {
        const client = loan.clients as { full_name: string; phone: string | null };
        if (!client.phone) continue;

        const installmentDates = (loan.installment_dates as string[]) || [];
        const numInstallments = loan.installments || 1;

        let totalInterest = loan.total_interest || 0;
        if (totalInterest === 0) {
          if (loan.interest_mode === 'on_total') {
            totalInterest = loan.principal_amount * (loan.interest_rate / 100);
          } else if (loan.interest_mode === 'compound') {
            const i = loan.interest_rate / 100;
            if (i > 0 && isFinite(i)) {
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
        const partialPayments = getPartialPaymentsFromNotes(loan.notes);

        const installmentValue = loan.payment_type === 'daily'
          ? (loan.total_interest || totalPerInstallment)
          : totalPerInstallment;

        // Check installments
        if (loan.payment_type === 'daily' && installmentDates.length > 0) {
          const dailyAmount = loan.total_interest || totalPerInstallment;
          for (let i = 0; i < installmentDates.length; i++) {
            const paidAmount = partialPayments[i] || 0;
            if (paidAmount >= dailyAmount * 0.99) continue;

            const installmentDate = installmentDates[i];
            const dueDate = new Date(installmentDate);
            dueDate.setHours(0, 0, 0, 0);

            const paidCount = Object.keys(partialPayments).filter(k => partialPayments[parseInt(k)] >= dailyAmount * 0.99).length;
            const progressPercent = Math.round((paidCount / numInstallments) * 100);

            if (installmentDate === todayStr && userReportTypes.includes('due_today')) {
              billingItems.push({
                clientName: client.full_name,
                clientPhone: client.phone,
                amount: dailyAmount,
                dueDate: installmentDate,
                installmentNumber: i + 1,
                totalInstallments: numInstallments,
                progressPercent,
                type: 'due_today',
                contractType: 'loan',
                contractId: loan.id,
              });
            } else if (dueDate < today && userReportTypes.includes('overdue')) {
              const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              billingItems.push({
                clientName: client.full_name,
                clientPhone: client.phone,
                amount: dailyAmount,
                dueDate: installmentDate,
                installmentNumber: i + 1,
                totalInstallments: numInstallments,
                progressPercent,
                type: 'overdue',
                daysOverdue,
                contractType: 'loan',
                contractId: loan.id,
              });
            }
          }
        } else {
          // Non-daily: find first unpaid installment
          let firstUnpaidIndex = -1;
          for (let i = 0; i < installmentDates.length; i++) {
            const paidAmount = partialPayments[i] || 0;
            if (paidAmount < installmentValue * 0.99) {
              firstUnpaidIndex = i;
              break;
            }
          }

          let nextDueDate: string | null = null;
          let installmentAmount = totalPerInstallment;
          let installmentNum = 1;

          if (firstUnpaidIndex >= 0 && firstUnpaidIndex < installmentDates.length) {
            nextDueDate = installmentDates[firstUnpaidIndex];
            installmentNum = firstUnpaidIndex + 1;
          } else if (loan.remaining_balance > 0) {
            nextDueDate = loan.due_date;
            if (loan.payment_type === 'single') installmentAmount = remainingBalance;
          }

          if (!nextDueDate) continue;

          const dueDate = new Date(nextDueDate);
          dueDate.setHours(0, 0, 0, 0);

          const paidCount = Object.keys(partialPayments).filter(k => partialPayments[parseInt(k)] >= installmentValue * 0.99).length;
          const progressPercent = Math.round((paidCount / numInstallments) * 100);

          if (nextDueDate === todayStr && userReportTypes.includes('due_today')) {
            billingItems.push({
              clientName: client.full_name,
              clientPhone: client.phone,
              amount: installmentAmount,
              dueDate: nextDueDate,
              installmentNumber: installmentNum,
              totalInstallments: numInstallments,
              progressPercent,
              type: 'due_today',
              contractType: 'loan',
              contractId: loan.id,
            });
          } else if (dueDate < today && userReportTypes.includes('overdue')) {
            const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            billingItems.push({
              clientName: client.full_name,
              clientPhone: client.phone,
              amount: installmentAmount,
              dueDate: nextDueDate,
              installmentNumber: installmentNum,
              totalInstallments: numInstallments,
              progressPercent,
              type: 'overdue',
              daysOverdue,
              contractType: 'loan',
              contractId: loan.id,
            });
          }
        }
      }

      // === VEHICLE PAYMENTS ===
      const { data: vehiclePayments } = await supabase
        .from('vehicle_payments')
        .select('*, vehicles!inner(brand, model, year, buyer_name, buyer_phone, installments, purchase_value, total_paid)')
        .eq('user_id', profile.id)
        .eq('status', 'pending');

      for (const payment of vehiclePayments || []) {
        const vehicle = payment.vehicles as any;
        const buyerPhone = vehicle.buyer_phone;
        if (!buyerPhone) continue;

        const dueDate = new Date(payment.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const progressPercent = Math.round(((vehicle.total_paid || 0) / vehicle.purchase_value) * 100);

        if (payment.due_date === todayStr && userReportTypes.includes('due_today')) {
          billingItems.push({
            clientName: vehicle.buyer_name || 'Cliente',
            clientPhone: buyerPhone,
            amount: payment.amount,
            dueDate: payment.due_date,
            installmentNumber: payment.installment_number,
            totalInstallments: vehicle.installments,
            progressPercent,
            type: 'due_today',
            contractType: 'vehicle',
            contractId: payment.vehicle_id,
          });
        } else if (dueDate < today && userReportTypes.includes('overdue')) {
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          billingItems.push({
            clientName: vehicle.buyer_name || 'Cliente',
            clientPhone: buyerPhone,
            amount: payment.amount,
            dueDate: payment.due_date,
            installmentNumber: payment.installment_number,
            totalInstallments: vehicle.installments,
            progressPercent,
            type: 'overdue',
            daysOverdue,
            contractType: 'vehicle',
            contractId: payment.vehicle_id,
          });
        }
      }

      // === PRODUCT SALE PAYMENTS ===
      const { data: productPayments } = await supabase
        .from('product_sale_payments')
        .select('*, productSale:product_sales!inner(product_name, client_name, client_phone, installments, total_amount, total_paid)')
        .eq('user_id', profile.id)
        .eq('status', 'pending');

      for (const payment of productPayments || []) {
        const sale = payment.productSale as any;
        if (!sale.client_phone) continue;

        const dueDate = new Date(payment.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const progressPercent = Math.round(((sale.total_paid || 0) / sale.total_amount) * 100);

        if (payment.due_date === todayStr && userReportTypes.includes('due_today')) {
          billingItems.push({
            clientName: sale.client_name,
            clientPhone: sale.client_phone,
            amount: payment.amount,
            dueDate: payment.due_date,
            installmentNumber: payment.installment_number,
            totalInstallments: sale.installments,
            progressPercent,
            type: 'due_today',
            contractType: 'product',
            contractId: payment.product_sale_id,
          });
        } else if (dueDate < today && userReportTypes.includes('overdue')) {
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          billingItems.push({
            clientName: sale.client_name,
            clientPhone: sale.client_phone,
            amount: payment.amount,
            dueDate: payment.due_date,
            installmentNumber: payment.installment_number,
            totalInstallments: sale.installments,
            progressPercent,
            type: 'overdue',
            daysOverdue,
            contractType: 'product',
            contractId: payment.product_sale_id,
          });
        }
      }

      if (billingItems.length === 0) {
        console.log(`User ${profile.id}: no billing items found`);
        continue;
      }

      // Deduplicate: max 1 message per client phone per day
      const sentToday = new Set<string>();

      // Check already sent today
      const { data: todayMessages } = await supabase
        .from('whatsapp_messages')
        .select('client_phone')
        .eq('user_id', profile.id)
        .gte('sent_at', todayStr + 'T00:00:00')
        .lte('sent_at', todayStr + 'T23:59:59');

      for (const msg of todayMessages || []) {
        sentToday.add(msg.client_phone.replace(/\D/g, ''));
      }

      // Group items by client phone
      const clientItems = new Map<string, ClientBillingItem[]>();
      for (const item of billingItems) {
        const cleanPhone = item.clientPhone.replace(/\D/g, '');
        if (sentToday.has(cleanPhone) || sentToday.has('55' + cleanPhone)) {
          totalSkipped++;
          continue;
        }
        if (!clientItems.has(cleanPhone)) {
          clientItems.set(cleanPhone, []);
        }
        clientItems.get(cleanPhone)!.push(item);
      }

      // Cap at 50 messages per user
      let userSentCount = 0;
      const MAX_MESSAGES_PER_USER = 50;

      for (const [cleanPhone, items] of clientItems) {
        if (userSentCount >= MAX_MESSAGES_PER_USER) break;

        // Use the first item for the message (most urgent)
        const item = items.sort((a, b) => {
          if (a.type === 'overdue' && b.type !== 'overdue') return -1;
          if (b.type === 'overdue' && a.type !== 'overdue') return 1;
          return (b.daysOverdue || 0) - (a.daysOverdue || 0);
        })[0];

        const template = item.type === 'overdue' ? templateOverdue : templateDueToday;
        const message = replaceTemplateVariables(template, {
          clientName: item.clientName,
          amount: item.amount,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
          dueDate: item.dueDate,
          daysOverdue: item.daysOverdue,
          progressPercent: item.progressPercent,
          pixKey: profile.pix_key,
          pixKeyType: profile.pix_key_type,
          pixPreMessage: profile.pix_pre_message,
          signatureName: profile.billing_signature_name,
        });

        const sent = await sendWhatsAppToClient(
          evolutionApiUrl,
          evolutionApiKey,
          instanceName,
          item.clientPhone,
          message
        );

        if (sent) {
          userSentCount++;
          totalSent++;
          sentToday.add(cleanPhone);

          // Log to whatsapp_messages
          await supabase.from('whatsapp_messages').insert({
            user_id: profile.id,
            client_name: item.clientName,
            client_phone: item.clientPhone,
            message_type: item.type === 'overdue' ? 'overdue' : 'due_today',
            contract_type: item.contractType,
            loan_id: item.contractType === 'loan' ? item.contractId : null,
            sent_at: new Date().toISOString(),
          });
        }

        // Cooldown between messages (2 seconds)
        if (userSentCount < MAX_MESSAGES_PER_USER) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`User ${profile.id}: sent ${userSentCount} messages`);
    }

    console.log(`Total: sent ${totalSent}, skipped ${totalSkipped}`);

    return new Response(
      JSON.stringify({ success: true, totalSent, totalSkipped, batch, batchSize }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in auto-client-billing:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
