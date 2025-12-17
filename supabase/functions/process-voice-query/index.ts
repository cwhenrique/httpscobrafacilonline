import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// System prompt for voice command interpretation
const SYSTEM_PROMPT = `Você é um assistente de voz para o CobraFácil, um sistema de gestão de empréstimos e cobranças.
Analise o áudio do usuário e identifique a intenção de consulta.

IMPORTANTE: Você só pode fazer CONSULTAS (leitura). NÃO é possível registrar pagamentos, criar empréstimos ou modificar dados.

Ações disponíveis:
- consulta_cliente: Buscar informação de um cliente específico pelo nome
- consulta_contrato: Buscar detalhes de contratos/empréstimos de um cliente
- consulta_vencimentos: Listar vencimentos de hoje, amanhã ou da semana
- consulta_atrasados: Listar clientes/contratos em atraso
- consulta_resumo: Resumo geral da operação

Retorne SEMPRE um JSON válido no formato:
{
  "transcricao": "texto transcrito do áudio",
  "acao": "consulta_cliente" | "consulta_contrato" | "consulta_vencimentos" | "consulta_atrasados" | "consulta_resumo" | "nao_entendi",
  "parametros": {
    "nome_cliente": "nome se mencionado ou null",
    "periodo": "hoje" | "amanha" | "semana" | null,
    "tipo_contrato": "emprestimo" | "produto" | "veiculo" | "contrato" | null
  },
  "mensagem_erro": "mensagem explicativa se acao=nao_entendi"
}

Exemplos de comandos válidos:
- "Quanto o João me deve?" → consulta_cliente, nome_cliente: "João"
- "Qual o contrato do Pedro?" → consulta_contrato, nome_cliente: "Pedro"
- "Me fala do empréstimo da Maria" → consulta_contrato, nome_cliente: "Maria", tipo_contrato: "emprestimo"
- "O que vence hoje?" → consulta_vencimentos, periodo: "hoje"
- "Quem tá atrasado?" → consulta_atrasados
- "Quem são os caloteiros?" → consulta_atrasados
- "Me dá um resumo" → consulta_resumo

Se o usuário pedir para registrar pagamento, criar empréstimo ou qualquer ação que MODIFIQUE dados,
retorne acao="nao_entendi" com mensagem explicando que apenas consultas são suportadas por voz.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, audioBase64, mimeType, senderPhone } = await req.json();
    
    console.log('🎤 Processing voice query for user:', userId);

    if (!userId || !audioBase64) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Evolution API config - use global central instance
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME')!;
    
    console.log('📱 Using central instance:', instanceName);

    // Send audio to Lovable AI for transcription and interpretation
    console.log('🤖 Sending audio to Lovable AI...');
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Clean audioBase64 - remove prefix if present
    let cleanAudioBase64 = audioBase64;
    if (audioBase64.includes('base64,')) {
      cleanAudioBase64 = audioBase64.split('base64,')[1];
    }

    // Determine proper MIME type
    let audioMimeType = mimeType || 'audio/ogg';
    if (!audioMimeType.startsWith('audio/')) {
      audioMimeType = `audio/${audioMimeType}`;
    }

    console.log('🎵 Audio details:', {
      mimeType: audioMimeType,
      base64Length: cleanAudioBase64?.length || 0,
      base64Preview: cleanAudioBase64?.substring(0, 50) + '...',
    });

    // Use inline_data format for Gemini multimodal
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${audioMimeType};base64,${cleanAudioBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Transcreva e interprete este áudio de acordo com as instruções do sistema.',
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Lovable AI error:', errorText);
      
      // Send error message back to user
      await sendWhatsAppMessage(evolutionApiUrl, evolutionApiKey, instanceName, senderPhone, 
        '❌ *Erro no processamento*\n\nNão consegui processar seu áudio. Tente novamente.');
      
      return new Response(JSON.stringify({ error: 'AI processing failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    console.log('🤖 AI Response:', aiContent);

    // Parse AI response
    let parsedResponse;
    try {
      // Extract JSON from response (it might be wrapped in markdown)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      await sendWhatsAppMessage(evolutionApiUrl, evolutionApiKey, instanceName, senderPhone,
        '❌ *Não entendi*\n\nPoderia repetir de forma mais clara?');
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { acao, parametros, mensagem_erro, transcricao } = parsedResponse;
    console.log('📝 Transcription:', transcricao);
    console.log('🎯 Action:', acao, 'Parameters:', parametros);

    // Handle action not understood
    if (acao === 'nao_entendi') {
      await sendWhatsAppMessage(evolutionApiUrl, evolutionApiKey, instanceName, senderPhone,
        `❓ *Não entendi*\n\n${mensagem_erro || 'Poderia repetir de forma mais clara?'}\n\n*Comandos disponíveis:*\n• Quanto o [nome] me deve?\n• Qual o contrato do [nome]?\n• O que vence hoje/amanhã?\n• Quem está atrasado?\n• Me dá um resumo`);
      return new Response(JSON.stringify({ success: true, action: 'nao_entendi' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute the appropriate query
    let responseMessage = '';

    switch (acao) {
      case 'consulta_cliente':
        responseMessage = await handleConsultaCliente(supabase, userId, parametros?.nome_cliente);
        break;
      case 'consulta_contrato':
        responseMessage = await handleConsultaContrato(supabase, userId, parametros?.nome_cliente, parametros?.tipo_contrato);
        break;
      case 'consulta_vencimentos':
        responseMessage = await handleConsultaVencimentos(supabase, userId, parametros?.periodo || 'hoje');
        break;
      case 'consulta_atrasados':
        responseMessage = await handleConsultaAtrasados(supabase, userId);
        break;
      case 'consulta_resumo':
        responseMessage = await handleConsultaResumo(supabase, userId);
        break;
      default:
        responseMessage = '❓ *Comando não reconhecido*\n\nTente: "Quanto o João me deve?" ou "O que vence hoje?"';
    }

    // Send response via WhatsApp
    await sendWhatsAppMessage(evolutionApiUrl, evolutionApiKey, instanceName, senderPhone, responseMessage);

    return new Response(JSON.stringify({ success: true, action: acao, response: responseMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error processing voice query:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to send WhatsApp message
async function sendWhatsAppMessage(apiUrl: string, apiKey: string, instance: string, phone: string, message: string) {
  try {
    await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

// ==================== FORMATTING HELPERS ====================

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
}

// Format date with weekday
function formatDateWithWeekday(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${weekdays[date.getDay()]}, ${date.toLocaleDateString('pt-BR')}`;
}

// Calculate days between dates
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T12:00:00');
  const d2 = new Date(date2 + 'T12:00:00');
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// Get current timestamp
function getCurrentTimestamp(): string {
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR');
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} • ${time}`;
}

// Generate unique consultation ID
function generateConsultaId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  return `#CF-${year}${month}${day}-${time}`;
}

// Create professional header
function createHeader(title: string, icon: string = '📊'): string {
  return `🏦 *COBRAFÁCIL* │ Assistente Inteligente
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${icon} ${title}
📅 ${getCurrentTimestamp()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
}

// Create footer
function createFooter(): string {
  return `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 *Assistente CobraFácil Premium*
     Consulta ${generateConsultaId()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// Create progress bar (0-100%)
function createProgressBar(percentage: number, length: number = 12): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

// Create section box
function createSection(title: string, content: string): string {
  return `╭─────────────────────────────╮
│  ${title}
╰─────────────────────────────╯
${content}`;
}

// Create simple divider
function createDivider(): string {
  return `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`;
}

// Get risk emoji based on days overdue
function getRiskEmoji(daysOverdue: number): string {
  if (daysOverdue > 30) return '🔴';
  if (daysOverdue > 14) return '🟠';
  if (daysOverdue > 7) return '🟡';
  return '⚠️';
}

// Get health score text
function getHealthScore(percentage: number): { emoji: string; text: string; bar: string } {
  const bar = createProgressBar(percentage, 16);
  if (percentage >= 90) return { emoji: '🟢', text: 'Excelente', bar };
  if (percentage >= 70) return { emoji: '🟡', text: 'Bom', bar };
  if (percentage >= 50) return { emoji: '🟠', text: 'Regular', bar };
  return { emoji: '🔴', text: 'Crítico', bar };
}

// Calculate overdue installment info for a loan (DYNAMIC calculation)
function calculateLoanOverdueInfo(loan: any): { isOverdue: boolean; installmentNumber: number; totalInstallments: number; dueDate: string; installmentValue: number; daysOverdue: number } | null {
  const today = new Date().toISOString().split('T')[0];
  const installmentDates: string[] = loan.installment_dates || [loan.due_date];
  const numInstallments = installmentDates.length;
  const totalContract = Number(loan.principal_amount) + Number(loan.total_interest || 0);
  const installmentValue = totalContract / numInstallments;
  const totalPaid = Number(loan.total_paid) || 0;
  
  const paidInstallments = Math.floor(totalPaid / installmentValue);
  
  for (let i = paidInstallments; i < numInstallments; i++) {
    const dueDate = installmentDates[i];
    if (dueDate && dueDate < today) {
      return {
        isOverdue: true,
        installmentNumber: i + 1,
        totalInstallments: numInstallments,
        dueDate,
        installmentValue,
        daysOverdue: daysBetween(dueDate, today),
      };
    }
  }
  
  return null;
}

// ==================== HANDLER FUNCTIONS ====================

// CONSULTA_CLIENTE: Get client debt summary with details
async function handleConsultaCliente(supabase: any, userId: string, nomeCliente: string | null): Promise<string> {
  if (!nomeCliente) {
    return createHeader('Consulta de Cliente', '👤') +
      `\n❓ *Nome não identificado*\n\nPor favor, diga o nome do cliente.\n\n💡 *Exemplo:* "Quanto o João me deve?"` +
      createFooter();
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, full_name, phone, score')
    .eq('user_id', userId)
    .ilike('full_name', `%${nomeCliente}%`)
    .limit(5);

  if (error || !clients?.length) {
    return createHeader('Consulta de Cliente', '👤') +
      `\n❌ *Cliente não encontrado*\n\nNão encontrei nenhum cliente com o nome "${nomeCliente}".` +
      createFooter();
  }

  if (clients.length > 1) {
    const names = clients.map((c: any, i: number) => `   ${i + 1}. ${c.full_name}`).join('\n');
    return createHeader('Múltiplos Resultados', '🔍') +
      `\n🔎 *Clientes encontrados:*\n\n${names}\n\n💡 Seja mais específico com o nome.` +
      createFooter();
  }

  const client = clients[0];
  const today = new Date().toISOString().split('T')[0];

  // Get loans
  const { data: loans } = await supabase
    .from('loans')
    .select('id, principal_amount, total_interest, remaining_balance, status, due_date, installments, installment_dates, total_paid, notes')
    .eq('user_id', userId)
    .eq('client_id', client.id)
    .neq('status', 'paid');

  // Get product sales
  const { data: products } = await supabase
    .from('product_sales')
    .select('id, product_name, total_amount, remaining_balance, status, installments, first_due_date, total_paid')
    .eq('user_id', userId)
    .ilike('client_name', `%${client.full_name}%`)
    .neq('status', 'paid');

  const productIds = products?.map((p: any) => p.id) || [];
  let productPayments: any[] = [];
  if (productIds.length > 0) {
    const { data } = await supabase
      .from('product_sale_payments')
      .select('id, product_sale_id, due_date, amount, installment_number, status')
      .eq('user_id', userId)
      .in('product_sale_id', productIds)
      .neq('status', 'paid')
      .order('due_date');
    productPayments = data || [];
  }

  // Get vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, purchase_value, remaining_balance, status, installments, first_due_date, total_paid')
    .eq('user_id', userId)
    .ilike('buyer_name', `%${client.full_name}%`)
    .neq('status', 'paid');

  const vehicleIds = vehicles?.map((v: any) => v.id) || [];
  let vehiclePayments: any[] = [];
  if (vehicleIds.length > 0) {
    const { data } = await supabase
      .from('vehicle_payments')
      .select('id, vehicle_id, due_date, amount, installment_number, status')
      .eq('user_id', userId)
      .in('vehicle_id', vehicleIds)
      .neq('status', 'paid')
      .order('due_date');
    vehiclePayments = data || [];
  }

  let totalDevido = 0;
  let totalPago = 0;
  let totalContrato = 0;
  let contractDetails: string[] = [];
  let overdueCount = 0;
  let nextDueDate = '';
  let nextDueAmount = 0;

  // Process loans
  if (loans?.length) {
    loans.forEach((loan: any) => {
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) return;
      
      const loanTotal = Number(loan.principal_amount) + Number(loan.total_interest || 0);
      totalContrato += loanTotal;
      totalDevido += Number(loan.remaining_balance) || 0;
      totalPago += Number(loan.total_paid) || 0;
      
      const overdueInfo = calculateLoanOverdueInfo(loan);
      const installmentDates: string[] = loan.installment_dates || [loan.due_date];
      const numInstallments = installmentDates.length;
      const paidCount = Math.floor((Number(loan.total_paid) || 0) / (loanTotal / numInstallments));
      const progress = Math.round((Number(loan.total_paid || 0) / loanTotal) * 100);
      
      if (overdueInfo) {
        overdueCount++;
        contractDetails.push(
          `┌─────────────────────────────┐
│  🔴 *EMPRÉSTIMO EM ATRASO*      │
├─────────────────────────────┤
│ 💵 Contrato: ${formatCurrency(loanTotal).padEnd(16)}│
│ 📊 Progresso: ${createProgressBar(progress, 10)} ${progress}%│
│                                 │
│ 🚨 *PARCELA ${overdueInfo.installmentNumber}/${overdueInfo.totalInstallments} ATRASADA*│
│ 💰 Valor: ${formatCurrency(overdueInfo.installmentValue).padEnd(18)}│
│ 📅 Venceu: ${formatDate(overdueInfo.dueDate).padEnd(17)}│
│ ⏰ *${overdueInfo.daysOverdue} dias de atraso*${' '.repeat(Math.max(0, 13 - String(overdueInfo.daysOverdue).length))}│
│                                 │
│ ⏳ Saldo: *${formatCurrency(loan.remaining_balance)}*│
└─────────────────────────────┘`
        );
      } else {
        const nextDate = installmentDates[Math.min(paidCount, installmentDates.length - 1)];
        if (!nextDueDate || nextDate < nextDueDate) {
          nextDueDate = nextDate;
          nextDueAmount = loanTotal / numInstallments;
        }
        contractDetails.push(
          `┌─────────────────────────────┐
│  🟢 *EMPRÉSTIMO*                 │
├─────────────────────────────┤
│ 💵 Contrato: ${formatCurrency(loanTotal).padEnd(16)}│
│ 📊 ${createProgressBar(progress, 10)} ${progress}% pago│
│ 🔢 Parcelas: ${paidCount}/${numInstallments} pagas${' '.repeat(Math.max(0, 10 - String(paidCount).length - String(numInstallments).length))}│
│ 📅 Próx. venc.: ${formatDate(nextDate)}       │
│ ⏳ Saldo: ${formatCurrency(loan.remaining_balance).padEnd(18)}│
└─────────────────────────────┘`
        );
      }
    });
  }

  // Process products
  if (products?.length) {
    products.forEach((product: any) => {
      totalContrato += Number(product.total_amount) || 0;
      totalDevido += Number(product.remaining_balance) || 0;
      totalPago += Number(product.total_paid) || 0;
      
      const payments = productPayments.filter((p: any) => p.product_sale_id === product.id);
      const overduePayment = payments.find((p: any) => p.due_date < today);
      const nextPayment = payments.find((p: any) => p.due_date >= today);
      const paidCount = product.installments - payments.length;
      const progress = Math.round((Number(product.total_paid || 0) / Number(product.total_amount)) * 100);
      
      if (overduePayment) {
        overdueCount++;
        const daysOverdue = daysBetween(overduePayment.due_date, today);
        contractDetails.push(
          `┌─────────────────────────────┐
│  🔴 *${(product.product_name || 'PRODUTO').toUpperCase().substring(0, 20)}* EM ATRASO│
├─────────────────────────────┤
│ 💵 Contrato: ${formatCurrency(product.total_amount).padEnd(16)}│
│ 📊 ${createProgressBar(progress, 10)} ${progress}% pago│
│                                 │
│ 🚨 *PARCELA ${overduePayment.installment_number}/${product.installments} ATRASADA*│
│ 💰 Valor: ${formatCurrency(overduePayment.amount).padEnd(18)}│
│ 📅 Venceu: ${formatDate(overduePayment.due_date).padEnd(17)}│
│ ⏰ *${daysOverdue} dias de atraso*${' '.repeat(Math.max(0, 13 - String(daysOverdue).length))}│
│                                 │
│ ⏳ Saldo: *${formatCurrency(product.remaining_balance)}*│
└─────────────────────────────┘`
        );
      } else if (nextPayment) {
        if (!nextDueDate || nextPayment.due_date < nextDueDate) {
          nextDueDate = nextPayment.due_date;
          nextDueAmount = nextPayment.amount;
        }
        contractDetails.push(
          `┌─────────────────────────────┐
│  🟢 *${(product.product_name || 'PRODUTO').toUpperCase().substring(0, 20)}*│
├─────────────────────────────┤
│ 💵 Contrato: ${formatCurrency(product.total_amount).padEnd(16)}│
│ 📊 ${createProgressBar(progress, 10)} ${progress}% pago│
│ 🔢 Parcelas: ${paidCount}/${product.installments} pagas│
│ 📅 Próx. venc.: ${formatDate(nextPayment.due_date)}│
│ ⏳ Saldo: ${formatCurrency(product.remaining_balance).padEnd(18)}│
└─────────────────────────────┘`
        );
      }
    });
  }

  // Process vehicles
  if (vehicles?.length) {
    vehicles.forEach((vehicle: any) => {
      totalContrato += Number(vehicle.purchase_value) || 0;
      totalDevido += Number(vehicle.remaining_balance) || 0;
      totalPago += Number(vehicle.total_paid) || 0;
      
      const payments = vehiclePayments.filter((p: any) => p.vehicle_id === vehicle.id);
      const overduePayment = payments.find((p: any) => p.due_date < today);
      const nextPayment = payments.find((p: any) => p.due_date >= today);
      const paidCount = vehicle.installments - payments.length;
      const progress = Math.round((Number(vehicle.total_paid || 0) / Number(vehicle.purchase_value)) * 100);
      const vehicleName = `${vehicle.brand} ${vehicle.model}`.substring(0, 18);
      
      if (overduePayment) {
        overdueCount++;
        const daysOverdue = daysBetween(overduePayment.due_date, today);
        contractDetails.push(
          `┌─────────────────────────────┐
│  🔴 *🚗 ${vehicleName}* ATRASO│
├─────────────────────────────┤
│ 💵 Contrato: ${formatCurrency(vehicle.purchase_value).padEnd(16)}│
│ 📊 ${createProgressBar(progress, 10)} ${progress}% pago│
│                                 │
│ 🚨 *PARCELA ${overduePayment.installment_number}/${vehicle.installments} ATRASADA*│
│ 💰 Valor: ${formatCurrency(overduePayment.amount).padEnd(18)}│
│ 📅 Venceu: ${formatDate(overduePayment.due_date).padEnd(17)}│
│ ⏰ *${daysOverdue} dias de atraso*│
│                                 │
│ ⏳ Saldo: *${formatCurrency(vehicle.remaining_balance)}*│
└─────────────────────────────┘`
        );
      } else if (nextPayment) {
        if (!nextDueDate || nextPayment.due_date < nextDueDate) {
          nextDueDate = nextPayment.due_date;
          nextDueAmount = nextPayment.amount;
        }
        contractDetails.push(
          `┌─────────────────────────────┐
│  🟢 *🚗 ${vehicleName}*│
├─────────────────────────────┤
│ 💵 Contrato: ${formatCurrency(vehicle.purchase_value).padEnd(16)}│
│ 📊 ${createProgressBar(progress, 10)} ${progress}% pago│
│ 🔢 Parcelas: ${paidCount}/${vehicle.installments} pagas│
│ 📅 Próx. venc.: ${formatDate(nextPayment.due_date)}│
│ ⏳ Saldo: ${formatCurrency(vehicle.remaining_balance).padEnd(18)}│
└─────────────────────────────┘`
        );
      }
    });
  }

  if (contractDetails.length === 0) {
    return createHeader('Relatório de Cliente', '👤') +
      `\n╔═══════════════════════════════╗
║        ✅ *SITUAÇÃO LIMPA*         ║
╚═══════════════════════════════╝

👤 *${client.full_name}*

Este cliente não possui débitos pendentes.

💡 *Dica:* Cliente sem pendências é um bom candidato para novo negócio!` +
      createFooter();
  }

  // Calculate score health
  const paymentProgress = totalContrato > 0 ? Math.round((totalPago / totalContrato) * 100) : 0;
  const health = getHealthScore(paymentProgress);
  const clientScore = client.score || 100;
  
  let message = createHeader('Relatório de Cliente', '👤');
  
  message += `\n╔═══════════════════════════════╗
║     👤 *${client.full_name.toUpperCase().substring(0, 22)}*     ║
╚═══════════════════════════════╝

`;

  // Situação Geral
  message += `╭─────── SITUAÇÃO GERAL ───────╮
│ 💰 Total Devido: *${formatCurrency(totalDevido)}*
│ 📋 Contratos Ativos: ${contractDetails.length}
│ ${overdueCount > 0 ? `🔴 Em Atraso: ${overdueCount} parcela${overdueCount > 1 ? 's' : ''}` : '✅ Nenhum atraso'}
╰────────────────────────────────╯

`;

  // Progresso de Pagamento
  message += `📊 *PROGRESSO DE PAGAMENTO*
${createProgressBar(paymentProgress, 12)} ${paymentProgress}%
${formatCurrency(totalPago)} pagos de ${formatCurrency(totalContrato)}

`;

  // Score do Cliente
  const scoreEmoji = clientScore >= 120 ? '⭐⭐⭐⭐⭐' : clientScore >= 100 ? '⭐⭐⭐⭐☆' : clientScore >= 80 ? '⭐⭐⭐☆☆' : clientScore >= 60 ? '⭐⭐☆☆☆' : '⭐☆☆☆☆';
  message += `📈 *SCORE DO CLIENTE*
${scoreEmoji} (${clientScore} pts)

`;

  // Contratos
  message += `📋 *CONTRATOS DETALHADOS*\n\n`;
  message += contractDetails.join('\n\n');

  // Análise Inteligente
  message += `\n\n💡 *ANÁLISE INTELIGENTE*`;
  if (overdueCount > 0) {
    message += `\n• ⚠️ Cliente com ${overdueCount} parcela${overdueCount > 1 ? 's' : ''} em atraso`;
    message += `\n• 📱 Recomendação: Enviar cobrança via WhatsApp`;
  } else if (nextDueDate) {
    const daysUntil = daysBetween(today, nextDueDate);
    if (daysUntil <= 3) {
      message += `\n• ⏰ Próximo vencimento em ${daysUntil} dia${daysUntil > 1 ? 's' : ''}`;
      message += `\n• 💰 Valor: ${formatCurrency(nextDueAmount)}`;
      message += `\n• 📱 Considere enviar lembrete amigável`;
    } else {
      message += `\n• ✅ Cliente em dia com os pagamentos`;
      message += `\n• 📅 Próximo vencimento: ${formatDate(nextDueDate)}`;
    }
  }
  
  message += `\n• 📊 Taxa de pagamento: ${paymentProgress}%`;

  message += createFooter();
  
  return message;
}

// CONSULTA_CONTRATO: Get specific contract details
async function handleConsultaContrato(supabase: any, userId: string, nomeCliente: string | null, tipoContrato: string | null): Promise<string> {
  if (!nomeCliente) {
    return createHeader('Consulta de Contrato', '📄') +
      `\n❓ *Nome não identificado*\n\nPor favor, diga o nome do cliente.\n\n💡 *Exemplo:* "Qual o contrato do João?"` +
      createFooter();
  }

  const today = new Date().toISOString().split('T')[0];
  const contracts: any[] = [];

  // Search loans
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, principal_amount, interest_rate, total_interest, remaining_balance, 
      status, due_date, start_date, installments, installment_dates, total_paid, payment_type, notes,
      clients!inner(full_name, score)
    `)
    .eq('user_id', userId)
    .ilike('clients.full_name', `%${nomeCliente}%`);

  if (loans?.length) {
    loans.forEach((loan: any) => {
      contracts.push({
        type: 'emprestimo',
        label: 'Empréstimo',
        data: loan,
        clientName: loan.clients?.full_name,
        clientScore: loan.clients?.score,
      });
    });
  }

  // Search product sales
  const { data: products } = await supabase
    .from('product_sales')
    .select('*')
    .eq('user_id', userId)
    .ilike('client_name', `%${nomeCliente}%`);

  if (products?.length) {
    for (const product of products) {
      const { data: payments } = await supabase
        .from('product_sale_payments')
        .select('*')
        .eq('product_sale_id', product.id)
        .order('due_date');
      
      contracts.push({
        type: 'produto',
        label: `Produto: ${product.product_name}`,
        data: { ...product, payments: payments || [] },
        clientName: product.client_name,
      });
    }
  }

  // Search vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .ilike('buyer_name', `%${nomeCliente}%`);

  if (vehicles?.length) {
    for (const vehicle of vehicles) {
      const { data: payments } = await supabase
        .from('vehicle_payments')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('due_date');
      
      contracts.push({
        type: 'veiculo',
        label: `Veículo: ${vehicle.brand} ${vehicle.model}`,
        data: { ...vehicle, payments: payments || [] },
        clientName: vehicle.buyer_name,
      });
    }
  }

  if (contracts.length === 0) {
    return createHeader('Consulta de Contrato', '📄') +
      `\n❌ *Nenhum contrato encontrado*\n\nNão encontrei contratos para "${nomeCliente}".` +
      createFooter();
  }

  let filtered = contracts;
  if (tipoContrato) {
    filtered = contracts.filter(c => c.type === tipoContrato);
    if (filtered.length === 0) {
      return createHeader('Consulta de Contrato', '📄') +
        `\n❌ *Nenhum ${tipoContrato} encontrado*\n\nO cliente "${nomeCliente}" não possui ${tipoContrato}s.` +
        createFooter();
    }
  }

  // If multiple contracts, list them
  if (filtered.length > 1 && !tipoContrato) {
    let message = createHeader('Múltiplos Contratos', '🔍');
    message += `\n╔═══════════════════════════════╗
║     📋 *CONTRATOS DE ${filtered[0].clientName.toUpperCase().substring(0, 14)}*     ║
╚═══════════════════════════════╝\n\n`;
    
    filtered.forEach((c, i) => {
      const d = c.data;
      let status = '🟡';
      let statusText = 'Pendente';
      
      if (c.type === 'emprestimo') {
        const overdueInfo = calculateLoanOverdueInfo(d);
        if (d.status === 'paid') {
          status = '✅'; statusText = 'Pago';
        } else if (overdueInfo) {
          status = '🔴'; statusText = `Parc. ${overdueInfo.installmentNumber} atrasada`;
        }
      } else {
        const overduePayment = d.payments?.find((p: any) => p.due_date < today && p.status !== 'paid');
        if (d.status === 'paid') {
          status = '✅'; statusText = 'Pago';
        } else if (overduePayment) {
          status = '🔴'; statusText = `Parc. ${overduePayment.installment_number} atrasada`;
        }
      }
      
      const balance = Number(d.remaining_balance) || 0;
      const progress = d.total_paid && d.total_amount ? Math.round((d.total_paid / d.total_amount) * 100) : 0;
      
      message += `┌─────────────────────────────┐
│ ${i + 1}. ${status} *${c.label.substring(0, 22)}*
├─────────────────────────────┤
│ 💰 Saldo: ${formatCurrency(balance)}
│ 📊 Status: ${statusText}
└─────────────────────────────┘\n\n`;
    });
    
    message += `💡 Diga o tipo específico.\nEx: "Me fala do empréstimo do ${nomeCliente}"`;
    message += createFooter();
    return message;
  }

  // Show details of single contract
  const contract = filtered[0];
  const d = contract.data;
  
  let statusEmoji = '🟡';
  let statusText = 'Pendente';
  let overdueDetails = '';
  let priority = '🟢 Normal';

  if (contract.type === 'emprestimo') {
    const overdueInfo = calculateLoanOverdueInfo(d);
    if (d.status === 'paid') {
      statusEmoji = '✅'; statusText = 'Quitado';
    } else if (overdueInfo) {
      statusEmoji = '🔴'; 
      statusText = 'Em Atraso';
      priority = overdueInfo.daysOverdue > 30 ? '🔴 Crítica' : overdueInfo.daysOverdue > 14 ? '🟠 Alta' : '🟡 Média';
      overdueDetails = `\n🚨 *PARCELA EM ATRASO*
┌─────────────────────────────┐
│ 📋 Parcela: ${overdueInfo.installmentNumber}/${overdueInfo.totalInstallments}
│ 💰 Valor: ${formatCurrency(overdueInfo.installmentValue)}
│ 📅 Venceu: ${formatDate(overdueInfo.dueDate)}
│ ⏰ *${overdueInfo.daysOverdue} dias de atraso*
│ ⚠️ Prioridade: ${priority}
└─────────────────────────────┘`;
    }
  } else {
    const overduePayment = d.payments?.find((p: any) => p.due_date < today && p.status !== 'paid');
    if (d.status === 'paid') {
      statusEmoji = '✅'; statusText = 'Quitado';
    } else if (overduePayment) {
      statusEmoji = '🔴';
      statusText = 'Em Atraso';
      const daysOverdue = daysBetween(overduePayment.due_date, today);
      priority = daysOverdue > 30 ? '🔴 Crítica' : daysOverdue > 14 ? '🟠 Alta' : '🟡 Média';
      overdueDetails = `\n🚨 *PARCELA EM ATRASO*
┌─────────────────────────────┐
│ 📋 Parcela: ${overduePayment.installment_number}/${d.installments}
│ 💰 Valor: ${formatCurrency(overduePayment.amount)}
│ 📅 Venceu: ${formatDate(overduePayment.due_date)}
│ ⏰ *${daysOverdue} dias de atraso*
│ ⚠️ Prioridade: ${priority}
└─────────────────────────────┘`;
    }
  }

  let message = createHeader('Detalhes do Contrato', '📄');
  
  message += `\n╔═══════════════════════════════╗
║     📄 *CONTRATO DETALHADO*        ║
╚═══════════════════════════════╝

👤 *Cliente:* ${contract.clientName}
📌 *Tipo:* ${contract.label}
${statusEmoji} *Status:* ${statusText}
${overdueDetails}
`;

  if (contract.type === 'emprestimo') {
    const totalContrato = Number(d.principal_amount) + Number(d.total_interest || 0);
    const numInstallments = (d.installment_dates || [d.due_date]).length;
    const paidCount = Math.floor((Number(d.total_paid) || 0) / (totalContrato / numInstallments));
    const progress = Math.round((Number(d.total_paid || 0) / totalContrato) * 100);
    
    message += `
╭─────── VALORES DO CONTRATO ───────╮
│ 💵 Principal: ${formatCurrency(d.principal_amount)}
│ 📈 Taxa de Juros: ${d.interest_rate}% ao mês
│ 💰 Juros Total: ${formatCurrency(d.total_interest || 0)}
│ 
│ 💎 *TOTAL DO CONTRATO: ${formatCurrency(totalContrato)}*
╰────────────────────────────────────╯

╭─────── PROGRESSO DE PAGAMENTO ───────╮
│ ${createProgressBar(progress, 14)} ${progress}%
│ 
│ ✅ Total Pago: ${formatCurrency(d.total_paid || 0)}
│ ⏳ Saldo Restante: *${formatCurrency(d.remaining_balance)}*
│ 🔢 Parcelas: ${paidCount}/${numInstallments} quitadas
╰────────────────────────────────────╯

📅 *Início:* ${formatDate(d.start_date)}
📅 *Vencimento Final:* ${formatDate(d.due_date)}`;
  } else {
    const paidPayments = d.payments?.filter((p: any) => p.status === 'paid').length || 0;
    const nextPayment = d.payments?.find((p: any) => p.status !== 'paid' && p.due_date >= today);
    const totalAmount = Number(d.total_amount || d.purchase_value);
    const progress = Math.round((Number(d.total_paid || 0) / totalAmount) * 100);
    
    message += `
╭─────── VALORES DO CONTRATO ───────╮
│ 💎 *TOTAL: ${formatCurrency(totalAmount)}*
│ ✅ Pago: ${formatCurrency(d.total_paid || 0)}
│ ⏳ Saldo: *${formatCurrency(d.remaining_balance)}*
╰────────────────────────────────────╯

╭─────── PROGRESSO DE PAGAMENTO ───────╮
│ ${createProgressBar(progress, 14)} ${progress}%
│ 
│ 🔢 Parcelas quitadas: ${paidPayments}/${d.installments}
╰────────────────────────────────────╯`;
    
    if (nextPayment) {
      message += `\n\n📅 *PRÓXIMA PARCELA*
┌─────────────────────────────┐
│ 📋 Parcela ${nextPayment.installment_number}/${d.installments}
│ 💰 Valor: ${formatCurrency(nextPayment.amount)}
│ 📅 Vencimento: ${formatDateWithWeekday(nextPayment.due_date)}
└─────────────────────────────┘`;
    }
  }

  // Insights
  message += `\n\n💡 *ANÁLISE DO CONTRATO*`;
  if (statusText === 'Em Atraso') {
    message += `\n• ⚠️ Contrato requer atenção imediata`;
    message += `\n• 📱 Envie cobrança via WhatsApp`;
  } else if (statusText === 'Quitado') {
    message += `\n• ✅ Contrato finalizado com sucesso`;
    message += `\n• 💡 Cliente elegível para novo negócio`;
  } else {
    message += `\n• ✅ Pagamentos em dia`;
    message += `\n• 📊 Contrato saudável`;
  }

  message += createFooter();
  
  return message;
}

// CONSULTA_VENCIMENTOS: List due dates
async function handleConsultaVencimentos(supabase: any, userId: string, periodo: string): Promise<string> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  let startDate = new Date(today);
  let endDate = new Date(today);
  let periodoLabel = '';
  let periodoIcon = '📅';

  switch (periodo) {
    case 'hoje':
      periodoLabel = `Hoje (${formatDate(todayStr)})`;
      periodoIcon = '📆';
      break;
    case 'amanha':
      startDate.setDate(startDate.getDate() + 1);
      endDate.setDate(endDate.getDate() + 1);
      periodoLabel = `Amanhã (${formatDate(startDate.toISOString().split('T')[0])})`;
      periodoIcon = '📆';
      break;
    case 'semana':
      endDate.setDate(endDate.getDate() + 7);
      periodoLabel = `Próximos 7 dias`;
      periodoIcon = '🗓️';
      break;
    default:
      periodoLabel = `Hoje`;
  }

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const vencimentos: any[] = [];

  // Get loan installments due
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, due_date, remaining_balance, installments, installment_dates, payment_type,
      principal_amount, total_interest, total_paid,
      clients!inner(full_name)
    `)
    .eq('user_id', userId)
    .neq('status', 'paid');

  if (loans?.length) {
    loans.forEach((loan: any) => {
      const dates: string[] = loan.installment_dates || [loan.due_date];
      const totalContract = Number(loan.principal_amount) + Number(loan.total_interest || 0);
      const installmentValue = totalContract / dates.length;
      const paidInstallments = Math.floor((Number(loan.total_paid) || 0) / installmentValue);
      
      for (let i = paidInstallments; i < dates.length; i++) {
        const date = dates[i];
        if (date >= startStr && date <= endStr) {
          vencimentos.push({
            date,
            name: loan.clients?.full_name,
            type: 'Empréstimo',
            typeIcon: '💳',
            amount: installmentValue,
            installment: `${i + 1}/${dates.length}`,
            balance: loan.remaining_balance,
          });
        }
      }
    });
  }

  // Get product sale payments due
  const { data: productPayments } = await supabase
    .from('product_sale_payments')
    .select(`
      id, due_date, amount, installment_number,
      product_sales!inner(client_name, product_name, installments, remaining_balance)
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('due_date', startStr)
    .lte('due_date', endStr);

  if (productPayments?.length) {
    productPayments.forEach((payment: any) => {
      vencimentos.push({
        date: payment.due_date,
        name: payment.product_sales?.client_name,
        type: payment.product_sales?.product_name || 'Produto',
        typeIcon: '📦',
        amount: payment.amount,
        installment: `${payment.installment_number}/${payment.product_sales?.installments}`,
        balance: payment.product_sales?.remaining_balance,
      });
    });
  }

  // Get vehicle payments due
  const { data: vehiclePayments } = await supabase
    .from('vehicle_payments')
    .select(`
      id, due_date, amount, installment_number,
      vehicles!inner(buyer_name, brand, model, installments, remaining_balance)
    `)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('due_date', startStr)
    .lte('due_date', endStr);

  if (vehiclePayments?.length) {
    vehiclePayments.forEach((payment: any) => {
      vencimentos.push({
        date: payment.due_date,
        name: payment.vehicles?.buyer_name,
        type: `${payment.vehicles?.brand} ${payment.vehicles?.model}`,
        typeIcon: '🚗',
        amount: payment.amount,
        installment: `${payment.installment_number}/${payment.vehicles?.installments}`,
        balance: payment.vehicles?.remaining_balance,
      });
    });
  }

  vencimentos.sort((a, b) => a.date.localeCompare(b.date));

  let message = createHeader(`Agenda de Cobranças`, periodoIcon);
  
  message += `\n╔═══════════════════════════════╗
║     ${periodoIcon} *${periodoLabel.toUpperCase()}*     ║
╚═══════════════════════════════╝\n`;

  if (vencimentos.length === 0) {
    message += `\n╭─────────────────────────────╮
│     ✅ *AGENDA LIVRE*          │
├─────────────────────────────┤
│ Nenhum vencimento para       │
│ este período.                 │
│                               │
│ 🎉 Aproveite para prospectar │
│    novos clientes!            │
╰─────────────────────────────╯`;
    message += createFooter();
    return message;
  }

  let total = 0;
  let currentDate = '';

  vencimentos.forEach((v, i) => {
    if (periodo === 'semana' && v.date !== currentDate) {
      currentDate = v.date;
      message += `\n┄┄┄ ${formatDateWithWeekday(v.date)} ┄┄┄\n`;
    }

    message += `\n┌─────────────────────────────┐
│ ${v.typeIcon} *${v.name?.substring(0, 20) || 'Cliente'}*
├─────────────────────────────┤
│ 📋 ${v.type.substring(0, 20)} (Parc. ${v.installment})
│ 💰 *Valor: ${formatCurrency(v.amount)}*
${periodo !== 'semana' ? `│ 📅 Vencimento: ${formatDate(v.date)}\n` : ''}│ ⏳ Saldo total: ${formatCurrency(v.balance)}
└─────────────────────────────┘`;
    total += v.amount;
  });

  // Summary
  message += `\n\n╔═══════════════════════════════╗
║     📊 *RESUMO DO PERÍODO*        ║
╠═══════════════════════════════╣
║ 📋 Cobranças: ${String(vencimentos.length).padEnd(16)}║
║ 💰 *Total: ${formatCurrency(total).padEnd(17)}*║
╚═══════════════════════════════╝`;

  // Insights
  message += `\n\n💡 *INSIGHTS*`;
  if (vencimentos.length >= 5) {
    message += `\n• 📈 Período movimentado: ${vencimentos.length} cobranças`;
    message += `\n• 📱 Prepare os lembretes de pagamento`;
  }
  if (total > 1000) {
    message += `\n• 💰 Valor expressivo a receber`;
  }

  message += createFooter();
  
  return message;
}

// CONSULTA_ATRASADOS: List overdue clients
async function handleConsultaAtrasados(supabase: any, userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const atrasados: any[] = [];

  // Get overdue loans
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, due_date, remaining_balance, notes, principal_amount, total_interest, 
      installment_dates, total_paid, installments,
      clients!inner(full_name, phone)
    `)
    .eq('user_id', userId)
    .neq('status', 'paid');

  if (loans?.length) {
    loans.forEach((loan: any) => {
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) return;
      
      const overdueInfo = calculateLoanOverdueInfo(loan);
      if (overdueInfo) {
        atrasados.push({
          name: loan.clients?.full_name,
          phone: loan.clients?.phone,
          type: 'Empréstimo',
          typeIcon: '💳',
          installment: `${overdueInfo.installmentNumber}/${overdueInfo.totalInstallments}`,
          installmentValue: overdueInfo.installmentValue,
          dueDate: overdueInfo.dueDate,
          daysOverdue: overdueInfo.daysOverdue,
          totalBalance: loan.remaining_balance,
        });
      }
    });
  }

  // Get overdue product payments
  const { data: productPayments } = await supabase
    .from('product_sale_payments')
    .select(`
      id, due_date, amount, installment_number, status,
      product_sales!inner(client_name, client_phone, product_name, installments, remaining_balance)
    `)
    .eq('user_id', userId)
    .neq('status', 'paid')
    .lt('due_date', today);

  if (productPayments?.length) {
    productPayments.forEach((payment: any) => {
      const daysOverdue = daysBetween(payment.due_date, today);
      atrasados.push({
        name: payment.product_sales?.client_name,
        phone: payment.product_sales?.client_phone,
        type: payment.product_sales?.product_name || 'Produto',
        typeIcon: '📦',
        installment: `${payment.installment_number}/${payment.product_sales?.installments}`,
        installmentValue: payment.amount,
        dueDate: payment.due_date,
        daysOverdue,
        totalBalance: payment.product_sales?.remaining_balance,
      });
    });
  }

  // Get overdue vehicle payments
  const { data: vehiclePayments } = await supabase
    .from('vehicle_payments')
    .select(`
      id, due_date, amount, installment_number, status,
      vehicles!inner(buyer_name, buyer_phone, brand, model, installments, remaining_balance)
    `)
    .eq('user_id', userId)
    .neq('status', 'paid')
    .lt('due_date', today);

  if (vehiclePayments?.length) {
    vehiclePayments.forEach((payment: any) => {
      const daysOverdue = daysBetween(payment.due_date, today);
      atrasados.push({
        name: payment.vehicles?.buyer_name,
        phone: payment.vehicles?.buyer_phone,
        type: `${payment.vehicles?.brand} ${payment.vehicles?.model}`,
        typeIcon: '🚗',
        installment: `${payment.installment_number}/${payment.vehicles?.installments}`,
        installmentValue: payment.amount,
        dueDate: payment.due_date,
        daysOverdue,
        totalBalance: payment.vehicles?.remaining_balance,
      });
    });
  }

  atrasados.sort((a, b) => b.daysOverdue - a.daysOverdue);

  let message = createHeader('Relatório de Inadimplência', '🚨');

  if (atrasados.length === 0) {
    message += `\n╔═══════════════════════════════╗
║     🎉 *PARABÉNS!*                 ║
╠═══════════════════════════════╣
║                               ║
║   ✅ Nenhum cliente em        ║
║      atraso no momento!       ║
║                               ║
║   📈 Sua carteira está        ║
║      100% em dia!             ║
║                               ║
╚═══════════════════════════════╝

💡 *Dica:* Continue monitorando os vencimentos para manter essa excelente performance!`;
    message += createFooter();
    return message;
  }

  let totalInstallments = 0;
  let totalBalance = 0;
  let critical = 0;
  let high = 0;
  let medium = 0;

  atrasados.forEach(a => {
    totalInstallments += a.installmentValue;
    totalBalance += a.totalBalance;
    if (a.daysOverdue > 30) critical++;
    else if (a.daysOverdue > 14) high++;
    else medium++;
  });

  // Summary header
  message += `\n╔═══════════════════════════════╗
║     🚨 *ALERTAS DE ATRASO*        ║
╠═══════════════════════════════╣
║ 📊 Total em atraso: ${String(atrasados.length).padEnd(9)}║
║ 💰 Valor parcelas: ${formatCurrency(totalInstallments).padEnd(10)}║
║ 💎 Saldo total: ${formatCurrency(totalBalance).padEnd(13)}║
╚═══════════════════════════════╝

`;

  // Priority breakdown
  if (critical > 0 || high > 0) {
    message += `⚠️ *PRIORIDADE DE COBRANÇA*
┌─────────────────────────────┐
${critical > 0 ? `│ 🔴 Crítico (>30 dias): ${critical} cliente${critical > 1 ? 's' : ''}\n` : ''}${high > 0 ? `│ 🟠 Alto (15-30 dias): ${high} cliente${high > 1 ? 's' : ''}\n` : ''}${medium > 0 ? `│ 🟡 Médio (<15 dias): ${medium} cliente${medium > 1 ? 's' : ''}\n` : ''}└─────────────────────────────┘

`;
  }

  message += `📋 *LISTA DETALHADA*\n`;

  atrasados.forEach((a, i) => {
    const riskEmoji = getRiskEmoji(a.daysOverdue);
    const priority = a.daysOverdue > 30 ? 'CRÍTICO' : a.daysOverdue > 14 ? 'ALTO' : 'MÉDIO';
    
    message += `
┌─────────────────────────────┐
│ ${riskEmoji} *${(a.name || 'Cliente').substring(0, 22)}*
├─────────────────────────────┤
│ ${a.typeIcon} ${a.type.substring(0, 20)}
│ 📋 Parcela ${a.installment} em atraso
│ 💰 Valor: *${formatCurrency(a.installmentValue)}*
│ 📅 Venceu: ${formatDate(a.dueDate)}
│ ⏰ *${a.daysOverdue} dia${a.daysOverdue > 1 ? 's' : ''} de atraso*
│ ⚠️ Prioridade: ${priority}
│ ⏳ Saldo total: ${formatCurrency(a.totalBalance)}
└─────────────────────────────┘`;
  });

  // Insights
  message += `\n\n💡 *RECOMENDAÇÕES*`;
  if (critical > 0) {
    message += `\n• 🔴 ${critical} cliente${critical > 1 ? 's' : ''} requer${critical > 1 ? 'em' : ''} ação URGENTE`;
  }
  message += `\n• 📱 Envie cobranças via WhatsApp`;
  message += `\n• 📞 Considere ligação para casos críticos`;
  message += `\n• 📋 Avalie renegociação se necessário`;

  message += createFooter();
  
  return message;
}

// CONSULTA_RESUMO: General summary
async function handleConsultaResumo(supabase: any, userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  // === LOANS ===
  const { data: loans } = await supabase
    .from('loans')
    .select('id, principal_amount, total_interest, remaining_balance, status, total_paid, installment_dates, due_date, notes')
    .eq('user_id', userId)
    .neq('status', 'paid');

  let loanCapital = 0;
  let loanInterest = 0;
  let loanReceived = 0;
  let loanOverdueCount = 0;
  let loanOverdueAmount = 0;
  let loanActiveCount = 0;

  if (loans?.length) {
    loans.forEach((loan: any) => {
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) return;
      
      loanActiveCount++;
      loanCapital += Number(loan.principal_amount) || 0;
      loanInterest += Number(loan.total_interest) || 0;
      loanReceived += Number(loan.total_paid) || 0;
      
      const overdueInfo = calculateLoanOverdueInfo(loan);
      if (overdueInfo) {
        loanOverdueCount++;
        loanOverdueAmount += Number(loan.remaining_balance) || 0;
      }
    });
  }

  // === PRODUCTS ===
  const { data: products } = await supabase
    .from('product_sales')
    .select('id, total_amount, remaining_balance, total_paid, status')
    .eq('user_id', userId)
    .neq('status', 'paid');

  let productTotal = 0;
  let productReceived = 0;
  let productActiveCount = products?.length || 0;

  if (products?.length) {
    products.forEach((p: any) => {
      productTotal += Number(p.total_amount) || 0;
      productReceived += Number(p.total_paid) || 0;
    });
  }

  const { data: overdueProductPayments } = await supabase
    .from('product_sale_payments')
    .select('id, amount')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .lt('due_date', today);

  let productOverdueCount = overdueProductPayments?.length || 0;
  let productOverdueAmount = overdueProductPayments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;

  // === VEHICLES ===
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, purchase_value, remaining_balance, total_paid, status')
    .eq('user_id', userId)
    .neq('status', 'paid');

  let vehicleTotal = 0;
  let vehicleReceived = 0;
  let vehicleActiveCount = vehicles?.length || 0;

  if (vehicles?.length) {
    vehicles.forEach((v: any) => {
      vehicleTotal += Number(v.purchase_value) || 0;
      vehicleReceived += Number(v.total_paid) || 0;
    });
  }

  const { data: overdueVehiclePayments } = await supabase
    .from('vehicle_payments')
    .select('id, amount')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .lt('due_date', today);

  let vehicleOverdueCount = overdueVehiclePayments?.length || 0;
  let vehicleOverdueAmount = overdueVehiclePayments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;

  // === TOTALS ===
  const totalCapital = loanCapital + productTotal + vehicleTotal;
  const totalReceived = loanReceived + productReceived + vehicleReceived;
  const totalOverdueCount = loanOverdueCount + productOverdueCount + vehicleOverdueCount;
  const totalOverdueAmount = loanOverdueAmount + productOverdueAmount + vehicleOverdueAmount;
  const totalActiveContracts = loanActiveCount + productActiveCount + vehicleActiveCount;
  const totalToReceive = totalCapital + loanInterest - totalReceived;
  
  // Calculate health score
  const healthPercentage = totalCapital > 0 ? Math.round(((totalCapital - totalOverdueAmount) / totalCapital) * 100) : 100;
  const health = getHealthScore(healthPercentage);

  const { count: clientesAtivos } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  let message = createHeader('Dashboard Executivo', '📊');
  
  message += `\n╔═══════════════════════════════╗
║     💰 *CAPITAL NA RUA*           ║
║                               ║
║      *${formatCurrency(totalCapital).padStart(15)}*      ║
║                               ║
╚═══════════════════════════════╝

`;

  // Financial Metrics
  message += `📊 *MÉTRICAS FINANCEIRAS*
┌──────────────────────────────┐
│ 💵 Capital Investido  ${formatCurrency(loanCapital).padStart(10)}
│ 📈 Juros a Receber    ${formatCurrency(loanInterest).padStart(10)}
│ ✅ Total Recebido     ${formatCurrency(totalReceived).padStart(10)}
│ ⏳ Falta Receber      ${formatCurrency(totalToReceive).padStart(10)}
└──────────────────────────────┘

`;

  // Contract Portfolio
  message += `📋 *CARTEIRA DE CONTRATOS*
┌──────────────────────────────┐
│ 💳 Empréstimos    ${String(loanActiveCount).padStart(3)} contratos
│    └ Valor: ${formatCurrency(loanCapital + loanInterest).padStart(15)}
│
│ 📦 Produtos       ${String(productActiveCount).padStart(3)} contratos
│    └ Valor: ${formatCurrency(productTotal).padStart(15)}
│
│ 🚗 Veículos       ${String(vehicleActiveCount).padStart(3)} contratos
│    └ Valor: ${formatCurrency(vehicleTotal).padStart(15)}
├──────────────────────────────┤
│ 📊 *TOTAL: ${String(totalActiveContracts).padStart(3)} contratos ativos*
└──────────────────────────────┘

`;

  // Alerts
  if (totalOverdueCount > 0) {
    message += `⚠️ *ALERTAS DE COBRANÇA*
┌──────────────────────────────┐
│ 🔴 ${totalOverdueCount} parcela${totalOverdueCount > 1 ? 's' : ''} em atraso
│ 💰 Valor em atraso: ${formatCurrency(totalOverdueAmount)}
│
│ 📱 Ação recomendada: Enviar
│    cobranças via WhatsApp
└──────────────────────────────┘

`;
  } else {
    message += `✅ *SITUAÇÃO DE COBRANÇA*
┌──────────────────────────────┐
│ 🎉 Nenhum atraso!            │
│ 📈 Carteira 100% em dia      │
└──────────────────────────────┘

`;
  }

  // Health Index
  message += `📈 *ÍNDICE DE SAÚDE DA OPERAÇÃO*
${health.bar} ${healthPercentage}%
${health.emoji} Status: *${health.text}*

`;

  // Quick Stats
  message += `╭─────── ESTATÍSTICAS ───────╮
│ 👥 ${clientesAtivos || 0} cliente${(clientesAtivos || 0) !== 1 ? 's' : ''} cadastrado${(clientesAtivos || 0) !== 1 ? 's' : ''}
│ 📋 ${totalActiveContracts} contrato${totalActiveContracts !== 1 ? 's' : ''} ativo${totalActiveContracts !== 1 ? 's' : ''}
${totalOverdueCount > 0 ? `│ ⚠️ ${totalOverdueCount} parcela${totalOverdueCount > 1 ? 's' : ''} em atraso\n` : ''}╰────────────────────────────╯`;

  // Insights
  message += `\n\n💡 *INSIGHTS AUTOMÁTICOS*`;
  if (totalOverdueCount > 0) {
    const overduePercentage = Math.round((totalOverdueAmount / totalCapital) * 100);
    message += `\n• ⚠️ ${overduePercentage}% do capital está em atraso`;
    message += `\n• 📱 Priorize as cobranças hoje`;
  }
  if (loanInterest > 0) {
    message += `\n• 💰 Juros potenciais: ${formatCurrency(loanInterest)}`;
  }
  if (totalReceived > 0) {
    const returnRate = Math.round((totalReceived / (totalCapital + loanInterest)) * 100);
    message += `\n• 📊 Taxa de retorno: ${returnRate}%`;
  }

  message += createFooter();
  
  return message;
}
