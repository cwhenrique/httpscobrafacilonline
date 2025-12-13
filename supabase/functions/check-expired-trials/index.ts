import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find expired trial users that are still active
    const now = new Date().toISOString();
    
    const { data: expiredUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, email, trial_expires_at')
      .not('trial_expires_at', 'is', null)
      .lt('trial_expires_at', now)
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching expired users:', fetchError);
      throw fetchError;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('No expired trial users found');
      return new Response(
        JSON.stringify({ message: 'No expired trials', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredUsers.length} expired trial users`);

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    for (const user of expiredUsers) {
      // Deactivate user
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: false })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Error deactivating user ${user.id}:`, updateError);
        continue;
      }

      console.log(`Deactivated user: ${user.email}`);

      // Send WhatsApp message
      if (evolutionApiUrl && evolutionApiKey && evolutionInstance && user.phone) {
        const formattedPhone = user.phone.replace(/\D/g, '').replace(/^0+/, '');
        const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

        const message = `⏰ *Seu período trial acabou!*

Olá ${user.full_name || 'Cliente'}!

Seu acesso trial de 24 horas ao *CobraFácil* expirou.

Gostou do sistema? 🤔

✅ Continue organizando suas cobranças
✅ Alertas automáticos via WhatsApp
✅ Cálculo automático de juros
✅ Calendário de cobranças

💰 *Assine agora com condição especial:*
https://pay.cakto.com.br/fhwfptb

Dúvidas? Responda esta mensagem!`;

        try {
          const cleanUrl = evolutionApiUrl.replace(/\/+$/, '').replace(/\/message\/sendText$/, '');
          const apiUrl = `${cleanUrl}/message/sendText/${evolutionInstance}`;

          await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              number: phoneWithCountry,
              text: message,
            }),
          });

          console.log('Expiration WhatsApp sent to:', phoneWithCountry);
        } catch (whatsappError) {
          console.error('Error sending WhatsApp:', whatsappError);
        }
      }

      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deactivated_count: expiredUsers.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
