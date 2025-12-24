import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cleanApiUrl(url: string): string {
  let cleanUrl = url.replace(/\/+$/, '');
  // Remove any path segments after the host
  const urlPattern = /^(https?:\/\/[^\/]+)/;
  const match = cleanUrl.match(urlPattern);
  return match ? match[1] : cleanUrl;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }
  if (cleaned.length === 11) {
    return '55' + cleaned;
  }
  if (cleaned.length === 10) {
    return '55' + cleaned;
  }
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    // Usar instância fixa "VendaApp" para notificações do sistema
    const evolutionInstanceName = "VendaApp";

    console.log(`Evolution config - URL: ${evolutionApiUrl ? 'SET' : 'MISSING'}, Key: ${evolutionApiKey ? 'SET' : 'MISSING'}, Instance: ${evolutionInstanceName}`);
    console.log("Using fixed system instance: VendaApp");

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log('Evolution API not configured - missing env vars');
      return { success: false, error: 'Evolution API not configured' };
    }

    const formattedPhone = formatPhoneNumber(phone);
    const cleanedApiUrl = cleanApiUrl(evolutionApiUrl);
    const fullUrl = `${cleanedApiUrl}/message/sendText/${evolutionInstanceName}`;

    console.log(`Sending to ${formattedPhone} via ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const responseText = await response.text();
    console.log(`Response for ${formattedPhone}: ${response.status} - ${responseText.substring(0, 200)}`);

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status} - ${responseText}` };
    }

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`Exception sending to ${phone}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

const UPDATE_MESSAGE = `🚀 *MEGA ATUALIZAÇÃO COBRAFÁCIL* 🚀

Olá! Trabalhamos intensamente para trazer novidades que vão transformar sua experiência de cobrança. Confira tudo que chegou:

━━━━━━━━━━━━━━━━━━━━━━

🎯 *SISTEMA INTELIGENTE DE AJUDA*
Agora você tem dicas visuais em TODA a plataforma! Basta passar o mouse sobre qualquer botão para entender sua função:
• Botões dos cards de empréstimo
• Botões do topo da página
• Filtros de status
• E muito mais!

━━━━━━━━━━━━━━━━━━━━━━

📚 *TUTORIAL GUIADO APRIMORADO*
Tutorial completo e passo-a-passo que te guia por todas as funcionalidades:
• Criação de empréstimos
• Registro de pagamentos
• Uso dos filtros
• Geração de relatórios
Acesse pelo botão "Tutorial" na página de Empréstimos!

━━━━━━━━━━━━━━━━━━━━━━

👤 *CLIENTE E EMPRÉSTIMO DE EXEMPLO*
Novos usuários agora começam com dados pré-preenchidos para explorar a plataforma sem medo!

━━━━━━━━━━━━━━━━━━━━━━

📄 *COMPROVANTES PDF PROFISSIONAIS*
Sistema completo de geração de PDFs com visual moderno e sua marca:
• Comprovante de contrato
• Comprovante de pagamento
• Comprovante de juros
• Relatório completo de operações

━━━━━━━━━━━━━━━━━━━━━━

💰 *SISTEMA DE JUROS EXTRA (RENOVAÇÃO)*
Aplique juros adicionais em parcelas específicas durante renegociações:
• Escolha qual parcela receberá o acréscimo
• Defina valor fixo ou percentual
• Cálculo automático do novo valor
• Notificação WhatsApp do ajuste

━━━━━━━━━━━━━━━━━━━━━━

💳 *CONTROLE DE PAGAMENTOS PARCIAIS*
• Acompanhe pagamentos incompletos
• Visualize "Pago: X | Falta: Y"
• Identifique pagamentos excedentes
• Histórico detalhado por parcela

━━━━━━━━━━━━━━━━━━━━━━

📲 *NOTIFICAÇÕES OTIMIZADAS*
• Mensagens consolidadas às 9h
• Menos spam, mais informação
• Alertas de atraso mantidos

━━━━━━━━━━━━━━━━━━━━━━

📅 *CALENDÁRIO UNIFICADO*
Visualização completa de TODAS as cobranças:
• Empréstimos
• Vendas de produtos
• Veículos
• Contratos
Tudo em um só lugar com cores diferenciadas!

━━━━━━━━━━━━━━━━━━━━━━

📊 *RELATÓRIOS AVANÇADOS*
• Filtro por período personalizado
• Comparativo com período anterior
• Gráficos de evolução temporal
• Separação por tipo de negócio

━━━━━━━━━━━━━━━━━━━━━━

💚 Obrigado por fazer parte do CobraFácil!
Acesse agora: https://cobrafacil.online

Dúvidas? Responda esta mensagem!`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify secret key
    const authHeader = req.headers.get('authorization');
    const expectedSecret = Deno.env.get('CAKTO_WEBHOOK_SECRET');
    
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      console.log('Unauthorized access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all users with phone numbers
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .not('phone', 'is', null)
      .neq('phone', '');

    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${profiles?.length || 0} users with phone numbers`);

    const results: { phone: string; name: string; success: boolean; error?: string }[] = [];

    // Send messages with delay to avoid rate limiting
    for (const profile of profiles || []) {
      if (!profile.phone) continue;

      console.log(`Sending to ${profile.full_name || 'Unknown'} (${profile.phone})...`);
      
      const result = await sendWhatsAppMessage(profile.phone, UPDATE_MESSAGE);
      
      results.push({
        phone: profile.phone,
        name: profile.full_name || 'Unknown',
        success: result.success,
        error: result.error,
      });

      // Wait 2 seconds between messages to avoid WhatsApp blocking
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Broadcast complete: ${successCount} success, ${failCount} failed`);

    return new Response(JSON.stringify({
      message: 'Broadcast complete',
      total: results.length,
      success: successCount,
      failed: failCount,
      details: results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Broadcast error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
