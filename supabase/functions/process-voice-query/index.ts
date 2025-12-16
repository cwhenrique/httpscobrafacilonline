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
- "Me dá um resumo" → consulta_resumo

Se o usuário pedir para registrar pagamento, criar empréstimo ou qualquer ação que MODIFIQUE dados,
retorne acao="nao_entendi" com mensagem explicando que apenas consultas são suportadas por voz.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, audioBase64, mimeType, senderPhone, instanceName } = await req.json();
    
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

    // Evolution API config
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    // Send audio to Lovable AI for transcription and interpretation
    console.log('🤖 Sending audio to Lovable AI...');
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Determine audio format for Gemini
    let audioFormat = 'ogg';
    if (mimeType?.includes('mp3')) audioFormat = 'mp3';
    else if (mimeType?.includes('wav')) audioFormat = 'wav';
    else if (mimeType?.includes('webm')) audioFormat = 'webm';

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
                type: 'input_audio',
                input_audio: {
                  data: audioBase64,
                  format: audioFormat,
                },
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

// CONSULTA_CLIENTE: Get client debt summary
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

  // Get loans for this client
  const { data: loans } = await supabase
    .from('loans')
    .select('id, principal_amount, total_interest, remaining_balance, status, due_date, installments, total_paid')
    .eq('user_id', userId)
    .eq('client_id', client.id)
    .neq('status', 'paid');

  // Get product sales for this client
  const { data: products } = await supabase
    .from('product_sales')
    .select('id, product_name, total_amount, remaining_balance, status')
    .eq('user_id', userId)
    .ilike('client_name', `%${client.full_name}%`)
    .neq('status', 'paid');

  // Get vehicles for this client
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, purchase_value, remaining_balance, status')
    .eq('user_id', userId)
    .ilike('buyer_name', `%${client.full_name}%`)
    .neq('status', 'paid');

  let totalDevido = 0;
  let activeContracts: string[] = [];

  // Sum loans
  if (loans?.length) {
    loans.forEach((loan: any) => {
      totalDevido += Number(loan.remaining_balance) || 0;
      const status = loan.status === 'overdue' ? '🔴' : '🟡';
      activeContracts.push(`${status} Empréstimo: ${formatCurrency(loan.remaining_balance)}`);
    });
  }

  // Sum products
  if (products?.length) {
    products.forEach((product: any) => {
      totalDevido += Number(product.remaining_balance) || 0;
      const status = product.status === 'overdue' ? '🔴' : '🟡';
      activeContracts.push(`${status} ${product.product_name}: ${formatCurrency(product.remaining_balance)}`);
    });
  }

  // Sum vehicles
  if (vehicles?.length) {
    vehicles.forEach((vehicle: any) => {
      totalDevido += Number(vehicle.remaining_balance) || 0;
      const status = vehicle.status === 'overdue' ? '🔴' : '🟡';
      activeContracts.push(`${status} ${vehicle.brand} ${vehicle.model}: ${formatCurrency(vehicle.remaining_balance)}`);
    });
  }

  if (activeContracts.length === 0) {
    return `✅ *${client.full_name}*\n\nEsse cliente não possui débitos pendentes.`;
  }

  let message = `📊 *Situação do Cliente*\n\n`;
  message += `👤 *${client.full_name}*\n`;
  message += `💰 Total devido: *${formatCurrency(totalDevido)}*\n\n`;
  message += `📋 *Contratos ativos:*\n${activeContracts.join('\n')}`;

  return message;
}

// CONSULTA_CONTRATO: Get specific contract details
async function handleConsultaContrato(supabase: any, userId: string, nomeCliente: string | null, tipoContrato: string | null): Promise<string> {
  if (!nomeCliente) {
    return '❓ *Nome não identificado*\n\nPor favor, diga o nome do cliente. Ex: "Qual o contrato do João?"';
  }

  // Get all contracts for this client
  const contracts: any[] = [];

  // Search loans
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, principal_amount, interest_rate, total_interest, remaining_balance, 
      status, due_date, start_date, installments, total_paid, payment_type,
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
    products.forEach((product: any) => {
      contracts.push({
        type: 'produto',
        label: `Produto: ${product.product_name}`,
        data: product,
        clientName: product.client_name,
      });
    });
  }

  // Search vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId)
    .ilike('buyer_name', `%${nomeCliente}%`);

  if (vehicles?.length) {
    vehicles.forEach((vehicle: any) => {
      contracts.push({
        type: 'veiculo',
        label: `Veículo: ${vehicle.brand} ${vehicle.model}`,
        data: vehicle,
        clientName: vehicle.buyer_name,
      });
    });
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

  // If multiple contracts and no type specified, list them
  if (filtered.length > 1 && !tipoContrato) {
    let message = `🔍 *Múltiplos contratos encontrados*\n\n`;
    message += `👤 *${filtered[0].clientName}*\n\n`;
    filtered.forEach((c, i) => {
      const status = c.data.status === 'overdue' ? '🔴' : c.data.status === 'paid' ? '✅' : '🟡';
      message += `${i + 1}. ${status} ${c.label} - ${formatCurrency(c.data.remaining_balance || 0)}\n`;
    });
    message += `\nDiga o tipo específico. Ex: "Me fala do empréstimo do ${nomeCliente}"`;
    return message;
  }

  // Show details of single contract
  const contract = filtered[0];
  const d = contract.data;
  const status = d.status === 'overdue' ? '🔴 Em Atraso' : d.status === 'paid' ? '✅ Pago' : '🟡 Pendente';

  let message = `📄 *Detalhes do Contrato*\n\n`;
  message += `👤 *${contract.clientName}*\n`;
  message += `📌 ${contract.label}\n`;
  message += `📊 Status: ${status}\n\n`;

  if (contract.type === 'emprestimo') {
    const totalContrato = Number(d.principal_amount) + Number(d.total_interest || 0);
    message += `💵 Principal: ${formatCurrency(d.principal_amount)}\n`;
    message += `📈 Juros: ${d.interest_rate}% (${formatCurrency(d.total_interest || 0)})\n`;
    message += `💰 Total do Contrato: ${formatCurrency(totalContrato)}\n`;
    message += `✅ Total Pago: ${formatCurrency(d.total_paid || 0)}\n`;
    message += `⏳ Saldo Restante: *${formatCurrency(d.remaining_balance)}*\n`;
    message += `📅 Vencimento: ${formatDate(d.due_date)}\n`;
    if (d.installments > 1) {
      message += `🔢 Parcelas: ${d.installments}x\n`;
    }
  } else {
    message += `💰 Valor Total: ${formatCurrency(d.total_amount || d.purchase_value)}\n`;
    message += `✅ Total Pago: ${formatCurrency(d.total_paid || 0)}\n`;
    message += `⏳ Saldo Restante: *${formatCurrency(d.remaining_balance)}*\n`;
    if (d.installments) {
      message += `🔢 Parcelas: ${d.installments}x\n`;
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

  // Get loan installments due
  const { data: loans } = await supabase
    .from('loans')
    .select(`
      id, due_date, remaining_balance, installments, installment_dates, payment_type,
      clients!inner(full_name)
    `)
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (loans?.length) {
    loans.forEach((loan: any) => {
      const dates = loan.installment_dates || [loan.due_date];
      dates.forEach((date: string, idx: number) => {
        if (date >= startStr && date <= endStr) {
          const installmentValue = loan.remaining_balance / (dates.length - idx) || loan.remaining_balance;
          vencimentos.push({
            date,
            name: loan.clients?.full_name,
            type: 'Empréstimo',
            amount: installmentValue,
            installment: `${idx + 1}/${dates.length}`,
          });
        }
      });
    });
  }

  // Get product sale payments due
  const { data: productPayments } = await supabase
    .from('product_sale_payments')
    .select(`
      id, due_date, amount, installment_number,
      product_sales!inner(client_name, product_name, installments)
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
      });
    });
  }

  // Get vehicle payments due
  const { data: vehiclePayments } = await supabase
    .from('vehicle_payments')
    .select(`
      id, due_date, amount, installment_number,
      vehicles!inner(buyer_name, brand, model, installments)
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
    message += `   ${v.type} (Parcela ${v.installment})\n`;
    message += `   💰 ${formatCurrency(v.amount)} - 📅 ${formatDate(v.date)}\n\n`;
    total += v.amount;
  });

  message += `💰 *Total: ${formatCurrency(total)}*\n`;
  message += `📊 ${vencimentos.length} cobrança${vencimentos.length > 1 ? 's' : ''} pendente${vencimentos.length > 1 ? 's' : ''}`;

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
      id, due_date, remaining_balance, notes,
      clients!inner(full_name)
    `)
    .eq('user_id', userId)
    .eq('status', 'overdue');

  if (loans?.length) {
    loans.forEach((loan: any) => {
      // Skip historical contracts
      if (loan.notes?.includes('[HISTORICAL_CONTRACT]')) return;
      
      const daysOverdue = Math.floor((new Date().getTime() - new Date(loan.due_date).getTime()) / (1000 * 60 * 60 * 24));
      atrasados.push({
        name: loan.clients?.full_name,
        type: 'Empréstimo',
        amount: loan.remaining_balance,
        daysOverdue,
      });
    });
  }

  // Get overdue product payments
  const { data: productPayments } = await supabase
    .from('product_sale_payments')
    .select(`
      id, due_date, amount,
      product_sales!inner(client_name, product_name)
    `)
    .eq('user_id', userId)
    .eq('status', 'overdue');

  if (productPayments?.length) {
    productPayments.forEach((payment: any) => {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24));
      atrasados.push({
        name: payment.product_sales?.client_name,
        type: payment.product_sales?.product_name || 'Produto',
        amount: payment.amount,
        daysOverdue,
      });
    });
  }

  // Get overdue vehicle payments
  const { data: vehiclePayments } = await supabase
    .from('vehicle_payments')
    .select(`
      id, due_date, amount,
      vehicles!inner(buyer_name, brand, model)
    `)
    .eq('user_id', userId)
    .eq('status', 'overdue');

  if (vehiclePayments?.length) {
    vehiclePayments.forEach((payment: any) => {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24));
      atrasados.push({
        name: payment.vehicles?.buyer_name,
        type: `${payment.vehicles?.brand} ${payment.vehicles?.model}`,
        amount: payment.amount,
        daysOverdue,
      });
    });
  }

  // Sort by days overdue (most overdue first)
  atrasados.sort((a, b) => b.daysOverdue - a.daysOverdue);

  if (atrasados.length === 0) {
    return `🚨 *Clientes em Atraso*\n\n✅ Nenhum cliente em atraso no momento!`;
  }

  let message = `🚨 *Clientes em Atraso*\n\n`;
  let total = 0;

  atrasados.forEach((a, i) => {
    message += `${i + 1}️⃣ *${a.name}*\n`;
    message += `   ${a.type}\n`;
    message += `   💰 ${formatCurrency(a.amount)} - ⏰ ${a.daysOverdue} dia${a.daysOverdue > 1 ? 's' : ''} em atraso\n\n`;
    total += a.amount;
  });

  message += `📊 *Total em atraso: ${formatCurrency(total)}*\n`;
  message += `👥 ${atrasados.length} cliente${atrasados.length > 1 ? 's' : ''} inadimplente${atrasados.length > 1 ? 's' : ''}`;

  return message;
}

// CONSULTA_RESUMO: General summary
async function handleConsultaResumo(supabase: any, userId: string): Promise<string> {
  // Get active loans
  const { data: loans } = await supabase
    .from('loans')
    .select('principal_amount, total_interest, remaining_balance, status, total_paid')
    .eq('user_id', userId)
    .neq('status', 'paid');

  let capitalNaRua = 0;
  let jurosAReceber = 0;
  let totalRecebido = 0;
  let emAtraso = 0;

  if (loans?.length) {
    loans.forEach((loan: any) => {
      capitalNaRua += Number(loan.principal_amount) || 0;
      jurosAReceber += Number(loan.total_interest) || 0;
      totalRecebido += Number(loan.total_paid) || 0;
      if (loan.status === 'overdue') {
        emAtraso += Number(loan.remaining_balance) || 0;
      }
    });
  }

  // Get today's due count
  const today = new Date().toISOString().split('T')[0];
  
  const { count: vencimentosHoje } = await supabase
    .from('loans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .eq('due_date', today);

  // Get overdue count
  const { count: atrasadosCount } = await supabase
    .from('loans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'overdue');

  // Get active clients count
  const { count: clientesAtivos } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  let message = `📊 *Resumo da Operação*\n\n`;
  message += `💰 Capital na rua: *${formatCurrency(capitalNaRua)}*\n`;
  message += `📈 Juros a receber: *${formatCurrency(jurosAReceber)}*\n`;
  message += `✅ Total recebido: *${formatCurrency(totalRecebido)}*\n\n`;
  
  message += `📅 *Hoje:*\n`;
  message += `• ${vencimentosHoje || 0} vencimento${(vencimentosHoje || 0) !== 1 ? 's' : ''}\n`;
  message += `• ${atrasadosCount || 0} em atraso (${formatCurrency(emAtraso)})\n\n`;
  
  message += `👥 ${clientesAtivos || 0} cliente${(clientesAtivos || 0) !== 1 ? 's' : ''} ativo${(clientesAtivos || 0) !== 1 ? 's' : ''}`;

  return message;
}
