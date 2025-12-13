import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Default password for new users
const DEFAULT_PASSWORD = 'mudar@123';

// Clean API URL - remove trailing slashes and any path segments
function cleanApiUrl(url: string): string {
  // Remove trailing slashes
  let cleaned = url.replace(/\/+$/, '');
  
  // Remove any path that might have been accidentally included
  // Common patterns: /message/sendText/InstanceName
  const pathPatterns = [
    /\/message\/sendText\/[^\/]+$/i,
    /\/message\/sendText$/i,
    /\/message$/i,
  ];
  
  for (const pattern of pathPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned;
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
    // Cakto sends data in: data.customer.email, data.customer.name, data.customer.phone
    const customerData = payload.data?.customer || payload.customer;
    const customerEmail = customerData?.email || payload.email;
    const customerName = customerData?.name || payload.name || customerData?.full_name;
    const customerPhone = customerData?.phone || payload.phone || customerData?.cellphone;
    const transactionStatus = payload.data?.status || payload.status || payload.event;

    console.log('Extracted customer data:', { email: customerEmail, name: customerName, phone: customerPhone, status: transactionStatus });

    // Only process approved/paid transactions
    const validStatuses = ['approved', 'paid', 'completed', 'active', 'subscription_created'];
    const statusToCheck = transactionStatus?.toLowerCase?.() || '';
    if (transactionStatus && !validStatuses.includes(statusToCheck)) {
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

    // Use default password for new user
    const generatedPassword = DEFAULT_PASSWORD;

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

    // Create example client for tutorial
    const { data: exampleClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        user_id: newUser.user.id,
        full_name: 'Cliente Exemplo',
        phone: '(00) 00000-0000',
        address: 'Endereço de Exemplo, 123',
        notes: '⚠️ Este é um cliente de exemplo para você conhecer o sistema. Você pode editá-lo ou excluí-lo a qualquer momento.',
        client_type: 'loan',
      })
      .select()
      .single();

    if (clientError) {
      console.error('Error creating example client:', clientError);
    } else {
      console.log('Example client created:', exampleClient.id);
      
      // Create example loan for tutorial
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setMonth(dueDate.getMonth() + 1);
      
      const principalAmount = 1000;
      const interestRate = 10;
      const totalInterest = principalAmount * (interestRate / 100);
      const remainingBalance = principalAmount + totalInterest;
      
      const { error: loanError } = await supabase
        .from('loans')
        .insert({
          user_id: newUser.user.id,
          client_id: exampleClient.id,
          principal_amount: principalAmount,
          interest_rate: interestRate,
          interest_type: 'simple',
          interest_mode: 'on_total',
          payment_type: 'single',
          installments: 1,
          installment_dates: [],
          start_date: today.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          total_interest: totalInterest,
          total_paid: 0,
          remaining_balance: remainingBalance,
          status: 'pending',
          notes: '📚 Este é um empréstimo de exemplo para você conhecer o sistema. Teste os botões de Pagar e Pagar Juros!',
        });

      if (loanError) {
        console.error('Error creating example loan:', loanError);
      } else {
        console.log('Example loan created successfully');
      }
    }

    // Send credentials via WhatsApp if phone is available
    if (customerPhone) {
      const welcomeMessage = `🎉 *Bem-vindo ao CobraFácil!*

Sua conta foi criada com sucesso!

📧 *Email:* ${customerEmail}
🔑 *Senha:* ${generatedPassword}

🔗 *Acesse:* https://cobrafacil.online/auth

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
