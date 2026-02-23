import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuração de categorias com emojis e dicas personalizadas
const CATEGORY_CONFIG: Record<string, { emoji: string; name: string; tip: string }> = {
  energia: { emoji: '⚡', name: 'Energia/Luz', tip: 'Não fique no escuro!' },
  agua: { emoji: '💧', name: 'Água', tip: 'Mantenha a torneira aberta!' },
  internet: { emoji: '📡', name: 'Internet', tip: 'Continue conectado!' },
  telefone: { emoji: '📱', name: 'Telefone', tip: 'Mantenha sua linha ativa!' },
  cartao: { emoji: '💳', name: 'Cartão de Crédito', tip: 'Evite juros do rotativo!' },
  aluguel: { emoji: '🏠', name: 'Aluguel', tip: 'Mantenha seu lar em dia!' },
  financiamento: { emoji: '🚗', name: 'Financiamento', tip: 'Evite atrasos no financiamento!' },
  seguro: { emoji: '🛡️', name: 'Seguro', tip: 'Mantenha sua proteção ativa!' },
  servicos: { emoji: '✂️', name: 'Serviços', tip: '' },
  streaming: { emoji: '📺', name: 'Streaming', tip: 'Suas séries dependem disso!' },
  supermercado: { emoji: '🛒', name: 'Supermercado', tip: '' },
  saude: { emoji: '❤️', name: 'Saúde', tip: 'Cuide da sua saúde!' },
  educacao: { emoji: '🎓', name: 'Educação', tip: 'Invista no seu futuro!' },
  outros: { emoji: '📦', name: 'Outros', tip: '' }
};

const getCategoryConfig = (category: string | null) => {
  return CATEGORY_CONFIG[category || 'outros'] || CATEGORY_CONFIG['outros'];
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

// Constrói linha da conta com PIX se disponível
const buildBillLine = (bill: any): string => {
  const cat = getCategoryConfig(bill.category);
  let line = `${cat.emoji} *${bill.payee_name}*: ${formatCurrency(bill.amount)}\n   📋 ${bill.description}`;
  
  if (bill.pix_key) {
    line += `\n   🔑 PIX: \`${bill.pix_key}\``;
  }
  
  return line;
};

const sendWhatsApp = async (phone: string, message: string, instanceToken: string): Promise<boolean> => {
  const uazapiUrl = Deno.env.get("UAZAPI_URL");
  if (!uazapiUrl || !instanceToken) {
    console.error("Missing UAZAPI URL or instance token");
    return false;
  }

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  try {
    const response = await fetch(`${uazapiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": instanceToken },
      body: JSON.stringify({ phone: cleaned, message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send WhatsApp to ${cleaned}: ${errorText}`);
      return false;
    }

    console.log(`WhatsApp sent to ${cleaned} via UAZAPI`);
    return true;
  } catch (error) {
    console.error(`Failed to send WhatsApp to ${cleaned}:`, error);
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("check-bills-due function called at", new Date().toISOString());
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log("Checking bills due on:", todayStr);

    // Fetch all pending bills due today
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('status', 'pending')
      .eq('due_date', todayStr);

    if (billsError) {
      console.error("Error fetching bills:", billsError);
      throw billsError;
    }

    console.log(`Found ${bills?.length || 0} bills due today`);

    if (!bills || bills.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          sentCount: 0,
          message: "No bills due today" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Group bills by user_id
    const userBillsMap: Map<string, any[]> = new Map();
    
    for (const bill of bills) {
      if (!userBillsMap.has(bill.user_id)) {
        userBillsMap.set(bill.user_id, []);
      }
      userBillsMap.get(bill.user_id)!.push(bill);
    }

    let sentCount = 0;

    // Send notifications to each user
    for (const [userId, userBills] of userBillsMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active, whatsapp_instance_token')
        .eq('id', userId)
        .single();

      // Skip inactive users or those without phone
      if (profileError || !profile?.phone || profile.is_active === false || !profile?.whatsapp_instance_token) {
        console.log(`User ${userId} is inactive, has no phone, or no instance token, skipping`);
        continue;
      }

      // Agrupar contas por categoria para mensagem organizada
      const billsByCategory = new Map<string, any[]>();
      for (const bill of userBills) {
        const cat = bill.category || 'outros';
        if (!billsByCategory.has(cat)) {
          billsByCategory.set(cat, []);
        }
        billsByCategory.get(cat)!.push(bill);
      }

      // Construir lista organizada por categoria
      let billsList = '';
      for (const [category, categoryBills] of billsByCategory) {
        const cat = getCategoryConfig(category);
        billsList += `\n*${cat.emoji} ${cat.name}*\n`;
        for (const bill of categoryBills) {
          billsList += buildBillLine(bill) + '\n';
        }
        if (cat.tip) {
          billsList += `_💡 ${cat.tip}_\n`;
        }
      }

      const totalAmount = userBills.reduce((sum, b) => sum + b.amount, 0);

      const message = `💸 *CONTAS A PAGAR HOJE!*\n\nOlá${profile.full_name ? ` ${profile.full_name}` : ''}! 👋\n\nVocê tem *${userBills.length} conta${userBills.length > 1 ? 's' : ''}* que vence${userBills.length > 1 ? 'm' : ''} *HOJE* (${formatDate(today)}):${billsList}\n━━━━━━━━━━━━━━━━\n💰 *TOTAL: ${formatCurrency(totalAmount)}*\n━━━━━━━━━━━━━━━━\n\n✅ Pague agora e fique em dia!\n\n_CobraFácil - Alerta automático_`;

      console.log(`Sending bills reminder to user ${userId}`);
      
      const sent = await sendWhatsApp(profile.phone, message, profile.whatsapp_instance_token);
      if (sent) {
        sentCount++;
      }
    }

    console.log(`Sent ${sentCount} WhatsApp messages for bills`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        billsChecked: bills.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-bills-due:", error);
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
