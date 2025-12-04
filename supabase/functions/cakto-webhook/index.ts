import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Generate random password
function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Clean API URL - remove trailing slashes and common path segments
function cleanApiUrl(url: string): string {
  let cleanUrl = url.replace(/\/+$/, '');
  const pathsToRemove = ['/message/sendText', '/message', '/send'];
  for (const path of pathsToRemove) {
    if (cleanUrl.endsWith(path)) {
      cleanUrl = cleanUrl.slice(0, -path.length);
    }
  }
  // Remove instance name if it's at the end
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');
  if (instanceName && cleanUrl.endsWith(`/${instanceName}`)) {
    cleanUrl = cleanUrl.slice(0, -(instanceName.length + 1));
  }
  return cleanUrl;
}

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(phone: string, message: string) {
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
  const evolutionInstanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

  if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstanceName) {
    console.log('Evolution API not configured, skipping WhatsApp message');
    return;
  }

  // Format phone number (remove non-digits and add country code if needed)
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '55' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  const cleanedUrl = cleanApiUrl(evolutionApiUrl);
  const fullUrl = `${cleanedUrl}/message/sendText/${evolutionInstanceName}`;
  console.log('Sending WhatsApp to URL:', fullUrl);

  try {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error sending WhatsApp message:', errorText);
    } else {
      console.log('WhatsApp message sent successfully to:', formattedPhone);
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret (from header OR URL parameter)
    const webhookSecret = Deno.env.get('CAKTO_WEBHOOK_SECRET');
    const url = new URL(req.url);
    const receivedSecret = req.headers.get('x-webhook-secret') || url.searchParams.get('secret');
    
    if (webhookSecret && receivedSecret !== webhookSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload = await req.json();
    console.log('Received Cakto webhook payload:', JSON.stringify(payload));

    // Extract customer data from Cakto payload
    // Cakto typically sends: customer.email, customer.name, customer.phone
    const customerEmail = payload.customer?.email || payload.email;
    const customerName = payload.customer?.name || payload.name || payload.customer?.full_name;
    const customerPhone = payload.customer?.phone || payload.phone || payload.customer?.cellphone;
    const transactionStatus = payload.status || payload.transaction?.status;

    // Only process approved/paid transactions
    const validStatuses = ['approved', 'paid', 'completed', 'active'];
    if (transactionStatus && !validStatuses.includes(transactionStatus.toLowerCase())) {
      console.log(`Transaction status "${transactionStatus}" is not approved, skipping user creation`);
      return new Response(
        JSON.stringify({ message: 'Transaction not approved, skipping' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customerEmail) {
      console.error('Missing customer email in payload');
      return new Response(
        JSON.stringify({ error: 'Missing customer email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if user already exists
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
    
    if (searchError) {
      console.error('Error searching for existing user:', searchError);
    }

    const existingUser = existingUsers?.users?.find(u => u.email === customerEmail);
    
    if (existingUser) {
      console.log('User already exists:', customerEmail);
      return new Response(
        JSON.stringify({ 
          message: 'User already exists',
          email: customerEmail
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate password for new user
    const generatedPassword = generatePassword(12);

    // Create new user in Supabase Auth
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      password: generatedPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: customerName || '',
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', newUser.user.id);

    // Update profile with phone if provided
    if (customerPhone && newUser.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          phone: customerPhone,
          full_name: customerName || null
        })
        .eq('id', newUser.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }

    // Send credentials via WhatsApp if phone is available
    if (customerPhone) {
      const welcomeMessage = `🎉 *Bem-vindo ao CobraFácil!*

Sua conta foi criada com sucesso!

📧 *Email:* ${customerEmail}
🔑 *Senha:* ${generatedPassword}

🔗 *Acesse:* https://cobrafacil.online

Recomendamos que você altere sua senha após o primeiro acesso.

Qualquer dúvida, estamos à disposição!`;

      await sendWhatsAppMessage(customerPhone, welcomeMessage);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User created successfully',
        userId: newUser.user.id,
        email: customerEmail
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
