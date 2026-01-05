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
  // Usar instância fixa "notficacao" para notificações do sistema
  const instanceName = "notficacao";

  if (!evolutionApiUrlRaw || !evolutionApiKey) {
    console.error("Missing Evolution API configuration");
    return false;
  }
  
  console.log("Using fixed system instance: notficacao");

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
    const notifications: any[] = [];

    // Send notifications to each user
    for (const [userId, userBills] of userBillsMap) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name, is_active')
        .eq('id', userId)
        .single();

      // Skip inactive users
      if (profileError || !profile?.phone || profile.is_active === false) {
        console.log(`User ${userId} is inactive or has no phone, skipping`);
        continue;
      }

      if (profileError || !profile?.phone) {
        console.log(`User ${userId} has no phone configured, skipping WhatsApp`);
        
        // Still create in-app notification even without phone
        for (const bill of userBills) {
          const cat = getCategoryConfig(bill.category);
          notifications.push({
            user_id: userId,
            title: `${cat.emoji} ${cat.name} vence hoje!`,
            message: `${bill.payee_name}: ${formatCurrency(bill.amount)} - ${bill.description}`,
            type: 'warning',
          });
        }
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
      
      const sent = await sendWhatsApp(profile.phone, message);
      if (sent) {
        sentCount++;
      }

      // Create in-app notifications for each bill with category-specific titles
      for (const bill of userBills) {
        const cat = getCategoryConfig(bill.category);
        notifications.push({
          user_id: userId,
          title: `${cat.emoji} ${cat.name} vence hoje!`,
          message: `${bill.payee_name}: ${formatCurrency(bill.amount)} - ${bill.description}`,
          type: 'warning',
        });
      }
    }

    // Create in-app notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.error("Error creating notifications:", notifError);
      } else {
        console.log(`Created ${notifications.length} in-app notifications`);
      }
    }

    console.log(`Sent ${sentCount} WhatsApp messages for bills`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount,
        billsChecked: bills.length,
        notificationsCreated: notifications.length
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
