import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Default password for new users
const DEFAULT_PASSWORD = '123456';

// Clean API URL - remove trailing slashes and any path segments
function cleanApiUrl(url: string): string {
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
}

// Determine subscription plan from Cakto payload
function getSubscriptionPlan(payload: any): { plan: string; expiresAt: string | null } {
  // Log full payload for debugging
  console.log('FULL CAKTO PAYLOAD FOR PLAN DETECTION:', JSON.stringify(payload, null, 2));
  
  // Try to extract product info from various Cakto payload structures
  const productName = (
    payload.data?.product?.name ||
    payload.product?.name ||
    payload.data?.offer?.name ||
    payload.offer?.name ||
    payload.data?.plan?.name ||
    payload.plan_name ||
    payload.data?.subscription?.plan?.name ||
    payload.subscription?.name ||
    payload.offer_name ||
    payload.product_name ||
    payload.data?.item?.name ||
    payload.item?.name ||
    ''
  ).toLowerCase();

  const productId = (
    payload.data?.product?.id ||
    payload.product?.id ||
    payload.data?.offer?.id ||
    payload.offer_id ||
    payload.data?.item?.id ||
    ''
  ).toLowerCase();

  // Extract price for fallback detection
  const price = parseFloat(
    payload.data?.total ||
    payload.total ||
    payload.data?.value ||
    payload.value ||
    payload.data?.amount ||
    payload.amount ||
    payload.data?.price ||
    payload.price ||
    '0'
  );

  console.log('Product detection:', { productName, productId, price });

  const now = new Date();

  // Check for lifetime/vitalício by name
  if (
    productName.includes('vitalício') ||
    productName.includes('vitalicio') ||
    productName.includes('lifetime') ||
    productName.includes('único') ||
    productName.includes('unico') ||
    productName.includes('pagamento único') ||
    productName.includes('pagamento unico') ||
    productName.includes('acesso completo') ||
    productName.includes('completo') ||
    productName.includes('forever') ||
    productName.includes('permanente') ||
    productId.includes('lifetime') ||
    productId.includes('vitalicio')
  ) {
    console.log('Matched: LIFETIME by name');
    return { plan: 'lifetime', expiresAt: null };
  }

  // Check for annual/anual by name
  if (
    productName.includes('anual') ||
    productName.includes('annual') ||
    productName.includes('ano') ||
    productName.includes('year') ||
    productId.includes('annual') ||
    productId.includes('anual')
  ) {
    console.log('Matched: ANNUAL by name');
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    return { plan: 'annual', expiresAt: expiresAt.toISOString() };
  }

  // Check for monthly/mensal by name
  if (
    productName.includes('mensal') ||
    productName.includes('monthly') ||
    productName.includes('mês') ||
    productName.includes('mes') ||
    productId.includes('monthly') ||
    productId.includes('mensal')
  ) {
    console.log('Matched: MONTHLY by name');
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    return { plan: 'monthly', expiresAt: expiresAt.toISOString() };
  }

  // FALLBACK: Use price to detect plan
  if (price > 0) {
    // Monthly: up to R$300
    if (price <= 300) {
      console.log('Matched: MONTHLY by price (R$', price, ')');
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      return { plan: 'monthly', expiresAt: expiresAt.toISOString() };
    }
    
    // Annual: above R$300 (e.g., R$479)
    if (price > 300) {
      console.log('Matched: ANNUAL by price (R$', price, ')');
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      return { plan: 'annual', expiresAt: expiresAt.toISOString() };
    }
  }

  // SAFE DEFAULT: Annual (middle ground)
  console.log('WARNING: No plan pattern matched! Defaulting to ANNUAL');
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return { plan: 'annual', expiresAt: expiresAt.toISOString() };
}

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(phone: string, message: string, instanceName?: string): Promise<boolean> {
  console.log('=== SEND WHATSAPP MESSAGE START ===');
  console.log('Input phone:', phone);
  console.log('Instance requested:', instanceName || 'default (VendaApp)');
  
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
  // Usar instância fixa "VendaApp" para notificações do sistema
  const instance = instanceName || "VendaApp";

  if (!evolutionApiUrl || !evolutionApiKey) {
    console.error('=== WHATSAPP ERROR: Evolution API not configured ===');
    console.error('EVOLUTION_API_URL:', evolutionApiUrl ? 'SET' : 'NOT SET');
    console.error('EVOLUTION_API_KEY:', evolutionApiKey ? 'SET' : 'NOT SET');
    return false;
  }
  
  console.log('Evolution API URL:', evolutionApiUrl);
  console.log('Using instance:', instance);

  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '55' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }
  
  console.log('Formatted phone:', formattedPhone);

  const cleanedUrl = cleanApiUrl(evolutionApiUrl);
  const fullUrl = `${cleanedUrl}/message/sendText/${instance}`;
  console.log('Full API URL:', fullUrl);

  try {
    console.log('Making fetch request to Evolution API...');
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

    console.log('Evolution API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== WHATSAPP ERROR: API returned error ===');
      console.error('Status:', response.status);
      console.error('Error response:', errorText);
      return false;
    }
    
    const responseData = await response.json();
    console.log('=== WHATSAPP SUCCESS ===');
    console.log('Response data:', JSON.stringify(responseData));
    console.log('Message sent to:', formattedPhone, 'via instance:', instance);
    return true;
  } catch (error) {
    console.error('=== WHATSAPP ERROR: Fetch failed ===');
    console.error('Error type:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error:', error);
    return false;
  }
}

// Get subscription time label in Portuguese
function getSubscriptionTimeLabel(plan: string): string {
  switch (plan) {
    case 'lifetime':
      return 'Vitalício';
    case 'annual':
      return '1 ano';
    case 'monthly':
      return '1 mês';
    default:
      return plan;
  }
}

// Get subscription price from payload
function getSubscriptionPrice(payload: any): string {
  const price = parseFloat(
    payload.data?.total ||
    payload.total ||
    payload.data?.value ||
    payload.value ||
    payload.data?.amount ||
    payload.amount ||
    payload.data?.price ||
    payload.price ||
    '0'
  );
  
  if (price > 0) {
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
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

    const payload = await req.json();
    console.log('Received Cakto webhook payload:', JSON.stringify(payload));

    // Extract customer data
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
      console.log(`Transaction status "${transactionStatus}" is not approved, skipping`);
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

    // Determine subscription plan
    const { plan, expiresAt } = getSubscriptionPlan(payload);
    console.log('Subscription plan determined:', { plan, expiresAt });

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if user already exists
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
    
    if (searchError) {
      console.error('Error searching for existing user:', searchError);
    }

    const existingUser = existingUsers?.users?.find(u => u.email === customerEmail);
    
    if (existingUser) {
      console.log('=== EXISTING USER FOUND ===');
      console.log('User ID:', existingUser.id);
      console.log('Email:', customerEmail);
      
      // Fetch current profile to check if it's a trial user
      const { data: currentProfile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_expires_at, trial_expires_at, is_active, updated_at')
        .eq('id', existingUser.id)
        .single();
      
      if (profileFetchError) {
        console.error('Error fetching current profile:', profileFetchError);
      }
      
      console.log('Current profile state:', {
        subscription_plan: currentProfile?.subscription_plan,
        subscription_expires_at: currentProfile?.subscription_expires_at,
        trial_expires_at: currentProfile?.trial_expires_at,
        is_active: currentProfile?.is_active,
        updated_at: currentProfile?.updated_at
      });
      
      // Check if this is a TRIAL user converting to paid
      const isTrialUser = currentProfile?.subscription_plan === 'trial' || 
                          currentProfile?.trial_expires_at !== null;
      
      // Check if profile was recently updated (within 2 minutes) to avoid duplicate processing
      const profileUpdatedAt = currentProfile?.updated_at ? new Date(currentProfile.updated_at) : null;
      const now = new Date();
      const minutesSinceProfileUpdate = profileUpdatedAt 
        ? (now.getTime() - profileUpdatedAt.getTime()) / (1000 * 60) 
        : Infinity;
      
      // Check if subscription_expires_at was already updated to this exact value
      const alreadyProcessed = currentProfile?.subscription_expires_at === expiresAt && 
                               currentProfile?.subscription_plan === plan &&
                               minutesSinceProfileUpdate < 2;
      
      if (alreadyProcessed) {
        console.log('=== DUPLICATE WEBHOOK DETECTED ===');
        console.log('Profile already has this exact plan and expiration, updated', minutesSinceProfileUpdate.toFixed(2), 'minutes ago');
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Webhook already processed (duplicate)',
            email: customerEmail,
            plan,
            expiresAt
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (isTrialUser) {
        console.log('=== TRIAL TO PAID CONVERSION ===');
        console.log('Converting trial user to paid plan');
        console.log('Previous plan: trial');
        console.log('New plan:', plan);
        console.log('New expires_at:', expiresAt);
      } else {
        console.log('=== SUBSCRIPTION RENEWAL ===');
        console.log('Previous plan:', currentProfile?.subscription_plan);
        console.log('New plan:', plan);
        console.log('New expires_at:', expiresAt);
      }
      
      // Update subscription - ALWAYS clear trial_expires_at when converting to paid
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_active: true,
          subscription_plan: plan,
          subscription_expires_at: expiresAt,
          trial_expires_at: null, // IMPORTANT: Clear trial when converting to paid
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update subscription',
            details: updateError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('=== SUBSCRIPTION UPDATED SUCCESSFULLY ===');
        console.log('is_active: true');
        console.log('subscription_plan:', plan);
        console.log('subscription_expires_at:', expiresAt);
        console.log('trial_expires_at: null (cleared)');
      }

      // Send renewal/conversion confirmation via WhatsApp
      if (customerPhone) {
        const planNames: Record<string, string> = {
          'lifetime': 'Vitalício',
          'annual': 'Anual',
          'monthly': 'Mensal',
        };
        
        // Different message for trial conversion vs renewal
        const messageTitle = isTrialUser 
          ? '🎉 *Assinatura Ativada!*' 
          : '🎉 *Assinatura Renovada!*';
        
        const messageBody = isTrialUser
          ? `Olá ${customerName || 'Cliente'}!

Seu período de teste acabou e sua assinatura do *CobraFácil* foi ativada com sucesso!`
          : `Olá ${customerName || 'Cliente'}!

Sua assinatura do *CobraFácil* foi renovada com sucesso!`;
        
        const renewalMessage = `${messageTitle}

${messageBody}

📦 *Plano:* ${planNames[plan] || plan}
${expiresAt ? `📅 *Válido até:* ${new Date(expiresAt).toLocaleDateString('pt-BR')}` : '♾️ *Acesso vitalício*'}

Obrigado por continuar com a gente! 💚`;

        const messageSent = await sendWhatsAppMessage(customerPhone, renewalMessage);
        console.log('WhatsApp message sent:', messageSent);
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: isTrialUser ? 'Trial converted to paid' : 'Subscription renewed',
          email: customerEmail,
          plan,
          expiresAt,
          wasTrialUser: isTrialUser
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NEW USER - Create account
    const generatedPassword = DEFAULT_PASSWORD;

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { full_name: customerName || '' }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', newUser.user.id);

    // Update profile with phone and subscription info
    if (newUser.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          phone: customerPhone || null,
          full_name: customerName || null,
          subscription_plan: plan,
          subscription_expires_at: expiresAt,
          is_active: true,
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
      
      // Create example loan
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
      }
    }

    // Send welcome message via WhatsApp using VendaApp instance
    console.log('=== WELCOME MESSAGE SECTION ===');
    console.log('Customer phone:', customerPhone);
    console.log('Customer name:', customerName);
    console.log('Customer email:', customerEmail);
    
    if (customerPhone) {
      console.log('Phone is present, preparing welcome message...');
      
      const welcomeMessage = `Olá ${customerName || ''}!

Seu acesso ao CobraFácil está liberado.

Acesse: https://cobrafacil.online/auth
Email: ${customerEmail}
Senha: 123456

Recomendamos alterar sua senha após o primeiro acesso.

Qualquer dúvida, estamos à disposição.`;

      console.log('Sending welcome message via SuporteApp instance...');
      const messageSent = await sendWhatsAppMessage(customerPhone, welcomeMessage, 'SuporteApp');
      
      if (messageSent) {
        console.log('=== WELCOME MESSAGE SENT SUCCESSFULLY ===');
      } else {
        console.error('=== WELCOME MESSAGE FAILED TO SEND ===');
      }
    } else {
      console.log('=== NO PHONE NUMBER - SKIPPING WELCOME MESSAGE ===');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User created successfully',
        userId: newUser.user.id,
        email: customerEmail,
        plan,
        expiresAt
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
