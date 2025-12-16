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

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
}

// Calculate days between dates
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T12:00:00');
  const d2 = new Date(date2 + 'T12:00:00');
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// Calculate overdue installment info for a loan (DYNAMIC calculation)
function calculateLoanOverdueInfo(loan: any): { isOverdue: boolean; installmentNumber: number; totalInstallments: number; dueDate: string; installmentValue: number; daysOverdue: number } | null {
  const today = new Date().toISOString().split('T')[0];
  const installmentDates: string[] = loan.installment_dates || [loan.due_date];
  const numInstallments = installmentDates.length;
  const totalContract = Number(loan.principal_amount) + Number(loan.total_interest || 0);
  const installmentValue = totalContract / numInstallments;
  const totalPaid = Number(loan.total_paid) || 0;
  
  // Calculate how many installments should be paid
  const paidInstallments = Math.floor(totalPaid / installmentValue);
  
  // Check each unpaid installment
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

// CONSULTA_CLIENTE: Get client debt summary with details
async function handleConsultaCliente(supabase: any, userId: string, nomeCliente: string | null): Promise<string> {
  if (!nomeCliente) {
    return '❓ *Nome não identificado*\n\nPor favor, diga o nome do cliente. Ex: "Quanto o João me deve?"';
  }

  // Search for client by name (case insensitive, partial match)
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, full_name, phone')
    .eq('user_id', userId)
    .ilike('full_name', `%${nomeCliente}%`)
    .limit(5);

  if (error || !clients?.length) {
    return `❌ *Cliente não encontrado*\n\nNão encontrei nenhum cliente com o nome "${nomeCliente}".`;
  }

  if (clients.length > 1) {
    const names = clients.map((c: any, i: number) => `${i + 1}. ${c.full_name}`).join('\n');
    return `🔍 *Múltiplos clientes encontrados*\n\n${names}\n\nSeja mais específico com o nome.`;
  }

  const client = clients[0];
  const today = new Date().toISOString().split('T')[0];

  // Get loans for this client with all details needed
  const { data: loans } = await supabase
    .from('loans')
    .select('id, principal_amount, total_interest, remaining_balance, status, due_date, installments, installment_dates, total_paid, notes')
    .eq('user_id', userId)
    .eq('client_id', client.id)
    .neq('status', 'paid');

  // Get product sales for this client
  const { data: products } = await supabase
    .from('product_sales')
    .select('id, product_name, total_amount, remaining_balance, status, installments, first_due_date')
    .eq('user_id', userId)
    .ilike('client_name', `%${client.full_name}%`)
    .neq('status', 'paid');

  // Get product sale payments (pending/overdue)
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

  // Get vehicles for this client
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, purchase_value, remaining_balance, status, installments, first_due_date')
    .eq('user_id', userId)
    .ilike('buyer_name', `%${client.full_name}%`)
    .neq('status', 'paid');

  // Get vehicle payments (pending/overdue)
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
  let activeContracts: string[] = [];

  // Process loans with dynamic overdue calculation
  if (loans?.length) {
    loans.forEach((loan: any) => {
      // Skip historical contracts
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) return;
      
      totalDevido += Number(loan.remaining_balance) || 0;
      
      const overdueInfo = calculateLoanOverdueInfo(loan);
      const totalContract = Number(loan.principal_amount) + Number(loan.total_interest || 0);
      const numInstallments = (loan.installment_dates || [loan.due_date]).length;
      
      if (overdueInfo) {
        activeContracts.push(
          `🔴 *Empréstimo* (${formatCurrency(totalContract)})\n` +
          `   📋 Parcela ${overdueInfo.installmentNumber}/${overdueInfo.totalInstallments} em atraso\n` +
          `   💰 Valor: ${formatCurrency(overdueInfo.installmentValue)}\n` +
          `   📅 Venceu: ${formatDate(overdueInfo.dueDate)} (${overdueInfo.daysOverdue} dias)\n` +
          `   ⏳ Saldo: ${formatCurrency(loan.remaining_balance)}`
        );
      } else {
        // Get next due date
        const installmentDates: string[] = loan.installment_dates || [loan.due_date];
        const paidCount = Math.floor((Number(loan.total_paid) || 0) / (totalContract / numInstallments));
        const nextDueDate = installmentDates[Math.min(paidCount, installmentDates.length - 1)];
        
        activeContracts.push(
          `🟡 *Empréstimo* (${formatCurrency(totalContract)})\n` +
          `   📋 Parcela ${paidCount + 1}/${numInstallments}\n` +
          `   📅 Próximo venc.: ${formatDate(nextDueDate)}\n` +
          `   ⏳ Saldo: ${formatCurrency(loan.remaining_balance)}`
        );
      }
    });
  }

  // Process products with payment details
  if (products?.length) {
    products.forEach((product: any) => {
      totalDevido += Number(product.remaining_balance) || 0;
      
      // Find next/overdue payment for this product
      const payments = productPayments.filter((p: any) => p.product_sale_id === product.id);
      const overduePayment = payments.find((p: any) => p.due_date < today);
      const nextPayment = payments.find((p: any) => p.due_date >= today);
      
      if (overduePayment) {
        const daysOverdue = daysBetween(overduePayment.due_date, today);
        activeContracts.push(
          `🔴 *${product.product_name}* (${formatCurrency(product.total_amount)})\n` +
          `   📋 Parcela ${overduePayment.installment_number}/${product.installments} em atraso\n` +
          `   💰 Valor: ${formatCurrency(overduePayment.amount)}\n` +
          `   📅 Venceu: ${formatDate(overduePayment.due_date)} (${daysOverdue} dias)\n` +
          `   ⏳ Saldo: ${formatCurrency(product.remaining_balance)}`
        );
      } else if (nextPayment) {
        activeContracts.push(
          `🟡 *${product.product_name}* (${formatCurrency(product.total_amount)})\n` +
          `   📋 Parcela ${nextPayment.installment_number}/${product.installments}\n` +
          `   📅 Próximo venc.: ${formatDate(nextPayment.due_date)}\n` +
          `   ⏳ Saldo: ${formatCurrency(product.remaining_balance)}`
        );
      }
    });
  }

  // Process vehicles with payment details
  if (vehicles?.length) {
    vehicles.forEach((vehicle: any) => {
      totalDevido += Number(vehicle.remaining_balance) || 0;
      
      // Find next/overdue payment for this vehicle
      const payments = vehiclePayments.filter((p: any) => p.vehicle_id === vehicle.id);
      const overduePayment = payments.find((p: any) => p.due_date < today);
      const nextPayment = payments.find((p: any) => p.due_date >= today);
      
      if (overduePayment) {
        const daysOverdue = daysBetween(overduePayment.due_date, today);
        activeContracts.push(
          `🔴 *${vehicle.brand} ${vehicle.model}* (${formatCurrency(vehicle.purchase_value)})\n` +
          `   📋 Parcela ${overduePayment.installment_number}/${vehicle.installments} em atraso\n` +
          `   💰 Valor: ${formatCurrency(overduePayment.amount)}\n` +
          `   📅 Venceu: ${formatDate(overduePayment.due_date)} (${daysOverdue} dias)\n` +
          `   ⏳ Saldo: ${formatCurrency(vehicle.remaining_balance)}`
        );
      } else if (nextPayment) {
        activeContracts.push(
          `🟡 *${vehicle.brand} ${vehicle.model}* (${formatCurrency(vehicle.purchase_value)})\n` +
          `   📋 Parcela ${nextPayment.installment_number}/${vehicle.installments}\n` +
          `   📅 Próximo venc.: ${formatDate(nextPayment.due_date)}\n` +
          `   ⏳ Saldo: ${formatCurrency(vehicle.remaining_balance)}`
        );
      }
    });
  }

  if (activeContracts.length === 0) {
    return `✅ *${client.full_name}*\n\nEsse cliente não possui débitos pendentes.`;
  }

  let message = `📊 *Situação do Cliente*\n\n`;
  message += `👤 *${client.full_name}*\n`;
  message += `💰 Total devido: *${formatCurrency(totalDevido)}*\n\n`;
  message += `📋 *Contratos:*\n\n${activeContracts.join('\n\n')}`;

  return message;
}

// CONSULTA_CONTRATO: Get specific contract details
async function handleConsultaContrato(supabase: any, userId: string, nomeCliente: string | null, tipoContrato: string | null): Promise<string> {
  if (!nomeCliente) {
    return '❓ *Nome não identificado*\n\nPor favor, diga o nome do cliente. Ex: "Qual o contrato do João?"';
  }

  const today = new Date().toISOString().split('T')[0];
  const contracts: any[] = [];

  // Search loans
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, principal_amount, interest_rate, total_interest, remaining_balance, 
      status, due_date, start_date, installments, installment_dates, total_paid, payment_type, notes,
      clients!inner(full_name)
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
      // Get payments for this product
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
      // Get payments for this vehicle
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
    return `❌ *Nenhum contrato encontrado*\n\nNão encontrei contratos para "${nomeCliente}".`;
  }

  // Filter by type if specified
  let filtered = contracts;
  if (tipoContrato) {
    filtered = contracts.filter(c => c.type === tipoContrato);
    if (filtered.length === 0) {
      return `❌ *Nenhum ${tipoContrato} encontrado*\n\nO cliente "${nomeCliente}" não possui ${tipoContrato}s.`;
    }
  }

  // If multiple contracts and no type specified, list them with details
  if (filtered.length > 1 && !tipoContrato) {
    let message = `🔍 *Múltiplos contratos de ${filtered[0].clientName}*\n\n`;
    
    filtered.forEach((c, i) => {
      const d = c.data;
      let status = '🟡';
      let statusText = 'Pendente';
      
      if (c.type === 'emprestimo') {
        const overdueInfo = calculateLoanOverdueInfo(d);
        if (d.status === 'paid') {
          status = '✅'; statusText = 'Pago';
        } else if (overdueInfo) {
          status = '🔴'; statusText = `Atraso (Parc. ${overdueInfo.installmentNumber})`;
        }
      } else {
        const overduePayment = d.payments?.find((p: any) => p.due_date < today && p.status !== 'paid');
        if (d.status === 'paid') {
          status = '✅'; statusText = 'Pago';
        } else if (overduePayment) {
          status = '🔴'; statusText = `Atraso (Parc. ${overduePayment.installment_number})`;
        }
      }
      
      message += `${i + 1}. ${status} *${c.label}*\n`;
      message += `   💰 Saldo: ${formatCurrency(d.remaining_balance || 0)}\n`;
      message += `   📊 ${statusText}\n\n`;
    });
    
    message += `Diga o tipo específico. Ex: "Me fala do empréstimo do ${nomeCliente}"`;
    return message;
  }

  // Show details of single contract
  const contract = filtered[0];
  const d = contract.data;
  
  let statusEmoji = '🟡';
  let statusText = 'Pendente';
  let overdueDetails = '';

  if (contract.type === 'emprestimo') {
    const overdueInfo = calculateLoanOverdueInfo(d);
    if (d.status === 'paid') {
      statusEmoji = '✅'; statusText = 'Pago';
    } else if (overdueInfo) {
      statusEmoji = '🔴'; 
      statusText = 'Em Atraso';
      overdueDetails = `\n🚨 *Parcela em atraso:* ${overdueInfo.installmentNumber}/${overdueInfo.totalInstallments}\n`;
      overdueDetails += `   💰 Valor: ${formatCurrency(overdueInfo.installmentValue)}\n`;
      overdueDetails += `   📅 Venceu: ${formatDate(overdueInfo.dueDate)}\n`;
      overdueDetails += `   ⏰ ${overdueInfo.daysOverdue} dias de atraso`;
    }
  } else {
    const overduePayment = d.payments?.find((p: any) => p.due_date < today && p.status !== 'paid');
    if (d.status === 'paid') {
      statusEmoji = '✅'; statusText = 'Pago';
    } else if (overduePayment) {
      statusEmoji = '🔴';
      statusText = 'Em Atraso';
      const daysOverdue = daysBetween(overduePayment.due_date, today);
      overdueDetails = `\n🚨 *Parcela em atraso:* ${overduePayment.installment_number}/${d.installments}\n`;
      overdueDetails += `   💰 Valor: ${formatCurrency(overduePayment.amount)}\n`;
      overdueDetails += `   📅 Venceu: ${formatDate(overduePayment.due_date)}\n`;
      overdueDetails += `   ⏰ ${daysOverdue} dias de atraso`;
    }
  }

  let message = `📄 *Detalhes do Contrato*\n\n`;
  message += `👤 *${contract.clientName}*\n`;
  message += `📌 ${contract.label}\n`;
  message += `${statusEmoji} Status: ${statusText}\n`;
  message += overdueDetails;
  message += `\n`;

  if (contract.type === 'emprestimo') {
    const totalContrato = Number(d.principal_amount) + Number(d.total_interest || 0);
    const numInstallments = (d.installment_dates || [d.due_date]).length;
    const paidCount = Math.floor((Number(d.total_paid) || 0) / (totalContrato / numInstallments));
    
    message += `💵 Principal: ${formatCurrency(d.principal_amount)}\n`;
    message += `📈 Juros: ${d.interest_rate}% (${formatCurrency(d.total_interest || 0)})\n`;
    message += `💰 Total do Contrato: *${formatCurrency(totalContrato)}*\n`;
    message += `✅ Total Pago: ${formatCurrency(d.total_paid || 0)}\n`;
    message += `⏳ Saldo Restante: *${formatCurrency(d.remaining_balance)}*\n`;
    message += `🔢 Parcelas Pagas: ${paidCount}/${numInstallments}\n`;
    message += `📅 Vencimento Final: ${formatDate(d.due_date)}`;
  } else {
    const paidPayments = d.payments?.filter((p: any) => p.status === 'paid').length || 0;
    const nextPayment = d.payments?.find((p: any) => p.status !== 'paid' && p.due_date >= today);
    
    message += `💰 Valor Total: *${formatCurrency(d.total_amount || d.purchase_value)}*\n`;
    message += `✅ Total Pago: ${formatCurrency(d.total_paid || 0)}\n`;
    message += `⏳ Saldo Restante: *${formatCurrency(d.remaining_balance)}*\n`;
    message += `🔢 Parcelas Pagas: ${paidPayments}/${d.installments}\n`;
    
    if (nextPayment) {
      message += `\n📅 *Próxima Parcela:*\n`;
      message += `   Parcela ${nextPayment.installment_number}/${d.installments}\n`;
      message += `   Valor: ${formatCurrency(nextPayment.amount)}\n`;
      message += `   Vencimento: ${formatDate(nextPayment.due_date)}`;
    }
  }

  return message;
}

// CONSULTA_VENCIMENTOS: List due dates
async function handleConsultaVencimentos(supabase: any, userId: string, periodo: string): Promise<string> {
  const today = new Date();
  let startDate = new Date(today);
  let endDate = new Date(today);
  let periodoLabel = '';

  switch (periodo) {
    case 'hoje':
      periodoLabel = `Hoje (${formatDate(today.toISOString().split('T')[0])})`;
      break;
    case 'amanha':
      startDate.setDate(startDate.getDate() + 1);
      endDate.setDate(endDate.getDate() + 1);
      periodoLabel = `Amanhã (${formatDate(startDate.toISOString().split('T')[0])})`;
      break;
    case 'semana':
      endDate.setDate(endDate.getDate() + 7);
      periodoLabel = `Próximos 7 dias`;
      break;
    default:
      periodoLabel = `Hoje`;
  }

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const vencimentos: any[] = [];

  // Get loan installments due (calculate dynamically)
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
      
      // Only check unpaid installments
      for (let i = paidInstallments; i < dates.length; i++) {
        const date = dates[i];
        if (date >= startStr && date <= endStr) {
          vencimentos.push({
            date,
            name: loan.clients?.full_name,
            type: 'Empréstimo',
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
        amount: payment.amount,
        installment: `${payment.installment_number}/${payment.vehicles?.installments}`,
        balance: payment.vehicles?.remaining_balance,
      });
    });
  }

  // Sort by date
  vencimentos.sort((a, b) => a.date.localeCompare(b.date));

  if (vencimentos.length === 0) {
    return `📅 *Vencimentos - ${periodoLabel}*\n\n✅ Nenhum vencimento para este período.`;
  }

  let message = `📅 *Vencimentos - ${periodoLabel}*\n\n`;
  let total = 0;

  vencimentos.forEach((v, i) => {
    message += `${i + 1}️⃣ *${v.name}*\n`;
    message += `   📋 ${v.type} (Parcela ${v.installment})\n`;
    message += `   💰 Valor: ${formatCurrency(v.amount)}\n`;
    message += `   📅 Vence: ${formatDate(v.date)}\n`;
    message += `   ⏳ Saldo total: ${formatCurrency(v.balance)}\n\n`;
    total += v.amount;
  });

  message += `━━━━━━━━━━━━━━━━\n`;
  message += `💰 *Total a receber: ${formatCurrency(total)}*\n`;
  message += `📊 ${vencimentos.length} cobrança${vencimentos.length > 1 ? 's' : ''}`;

  return message;
}

// CONSULTA_ATRASADOS: List overdue clients (DYNAMIC calculation)
async function handleConsultaAtrasados(supabase: any, userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const atrasados: any[] = [];

  // Get ALL non-paid loans and calculate overdue dynamically
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, due_date, remaining_balance, notes, principal_amount, total_interest, 
      installment_dates, total_paid, installments,
      clients!inner(full_name)
    `)
    .eq('user_id', userId)
    .neq('status', 'paid');

  if (loans?.length) {
    loans.forEach((loan: any) => {
      // Skip historical contracts
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) return;
      
      const overdueInfo = calculateLoanOverdueInfo(loan);
      if (overdueInfo) {
        atrasados.push({
          name: loan.clients?.full_name,
          type: 'Empréstimo',
          installment: `${overdueInfo.installmentNumber}/${overdueInfo.totalInstallments}`,
          installmentValue: overdueInfo.installmentValue,
          dueDate: overdueInfo.dueDate,
          daysOverdue: overdueInfo.daysOverdue,
          totalBalance: loan.remaining_balance,
        });
      }
    });
  }

  // Get overdue product payments (status check + date check for pending)
  const { data: productPayments } = await supabase
    .from('product_sale_payments')
    .select(`
      id, due_date, amount, installment_number, status,
      product_sales!inner(client_name, product_name, installments, remaining_balance)
    `)
    .eq('user_id', userId)
    .neq('status', 'paid')
    .lt('due_date', today);

  if (productPayments?.length) {
    productPayments.forEach((payment: any) => {
      const daysOverdue = daysBetween(payment.due_date, today);
      atrasados.push({
        name: payment.product_sales?.client_name,
        type: payment.product_sales?.product_name || 'Produto',
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
      vehicles!inner(buyer_name, brand, model, installments, remaining_balance)
    `)
    .eq('user_id', userId)
    .neq('status', 'paid')
    .lt('due_date', today);

  if (vehiclePayments?.length) {
    vehiclePayments.forEach((payment: any) => {
      const daysOverdue = daysBetween(payment.due_date, today);
      atrasados.push({
        name: payment.vehicles?.buyer_name,
        type: `${payment.vehicles?.brand} ${payment.vehicles?.model}`,
        installment: `${payment.installment_number}/${payment.vehicles?.installments}`,
        installmentValue: payment.amount,
        dueDate: payment.due_date,
        daysOverdue,
        totalBalance: payment.vehicles?.remaining_balance,
      });
    });
  }

  // Sort by days overdue (most overdue first)
  atrasados.sort((a, b) => b.daysOverdue - a.daysOverdue);

  if (atrasados.length === 0) {
    return `🎉 *Clientes em Atraso*\n\n✅ Parabéns! Nenhum cliente em atraso no momento!`;
  }

  let message = `🚨 *Clientes em Atraso*\n\n`;
  let totalInstallments = 0;
  let totalBalance = 0;

  atrasados.forEach((a, i) => {
    message += `${i + 1}️⃣ *${a.name}*\n`;
    message += `   📋 ${a.type}\n`;
    message += `   🔴 Parcela ${a.installment} em atraso\n`;
    message += `   💰 Valor parcela: ${formatCurrency(a.installmentValue)}\n`;
    message += `   📅 Venceu: ${formatDate(a.dueDate)}\n`;
    message += `   ⏰ ${a.daysOverdue} dia${a.daysOverdue > 1 ? 's' : ''} de atraso\n`;
    message += `   ⏳ Saldo total: ${formatCurrency(a.totalBalance)}\n\n`;
    totalInstallments += a.installmentValue;
    totalBalance += a.totalBalance;
  });

  message += `━━━━━━━━━━━━━━━━\n`;
  message += `📊 *Resumo:*\n`;
  message += `• ${atrasados.length} parcela${atrasados.length > 1 ? 's' : ''} em atraso\n`;
  message += `• Valor das parcelas: ${formatCurrency(totalInstallments)}\n`;
  message += `• Saldo total devido: ${formatCurrency(totalBalance)}`;

  return message;
}

// CONSULTA_RESUMO: General summary (includes all contract types)
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

  // Get overdue product payments
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

  // Get overdue vehicle payments
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

  // Get active clients count
  const { count: clientesAtivos } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  let message = `📊 *Resumo da Operação*\n\n`;
  
  message += `💰 *Valores Gerais:*\n`;
  message += `• Capital na rua: *${formatCurrency(totalCapital)}*\n`;
  message += `• Juros a receber: *${formatCurrency(loanInterest)}*\n`;
  message += `• Total recebido: *${formatCurrency(totalReceived)}*\n\n`;
  
  message += `📋 *Contratos Ativos:*\n`;
  message += `• Empréstimos: ${loanActiveCount} (${formatCurrency(loanCapital + loanInterest)})\n`;
  message += `• Produtos: ${productActiveCount} (${formatCurrency(productTotal)})\n`;
  message += `• Veículos: ${vehicleActiveCount} (${formatCurrency(vehicleTotal)})\n`;
  message += `• *Total: ${totalActiveContracts} contratos*\n\n`;
  
  if (totalOverdueCount > 0) {
    message += `🚨 *Em Atraso:*\n`;
    message += `• ${totalOverdueCount} parcela${totalOverdueCount > 1 ? 's' : ''} atrasada${totalOverdueCount > 1 ? 's' : ''}\n`;
    message += `• Valor: ${formatCurrency(totalOverdueAmount)}\n\n`;
  } else {
    message += `✅ *Nenhum atraso!*\n\n`;
  }
  
  message += `👥 ${clientesAtivos || 0} cliente${(clientesAtivos || 0) !== 1 ? 's' : ''} cadastrado${(clientesAtivos || 0) !== 1 ? 's' : ''}`;

  return message;
}
