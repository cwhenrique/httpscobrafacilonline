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

    const { email, password, full_name, phone } = await req.json();

    if (!email || !password || !full_name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate trial expiration (24 hours from now)
    const trialExpiresAt = new Date();
    trialExpiresAt.setHours(trialExpiresAt.getHours() + 24);

    // Create user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (userError) {
      console.error('Error creating user:', userError);
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile with phone and trial expiration
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        phone,
        trial_expires_at: trialExpiresAt.toISOString()
      })
      .eq('id', userData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Send WhatsApp welcome message
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (evolutionApiUrl && evolutionApiKey && evolutionInstance) {
      const formattedPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
      const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

      const message = `🎉 *Bem-vindo ao CobraFácil!*

Olá ${full_name}!

Seu acesso trial de *24 horas* foi ativado com sucesso!

📧 *Email:* ${email}
🔑 *Senha:* ${password}

🔗 Acesse agora: https://cobrafacil.online/auth

Aproveite para conhecer todas as funcionalidades do sistema!

⏰ Seu acesso expira em 24 horas.`;

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

        console.log('Welcome WhatsApp sent to:', phoneWithCountry);
      } catch (whatsappError) {
        console.error('Error sending WhatsApp:', whatsappError);
      }
    }

    console.log('Trial user created:', email, 'expires:', trialExpiresAt.toISOString());

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userData.user.id,
        trial_expires_at: trialExpiresAt.toISOString()
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
