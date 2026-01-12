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

// Helper function to find user by email (handles pagination and fallbacks)
async function findUserByEmail(supabase: any, email: string): Promise<{ id: string; email: string } | null> {
  console.log('=== SEARCHING FOR USER BY EMAIL ===');
  console.log('Email to search:', email);
  
  // First, try to find user in profiles table (faster and more reliable)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  
  if (profileData && profileData.id) {
    console.log('User found in profiles table:', profileData.id);
    return { id: profileData.id, email: profileData.email || email };
  }
  
  if (profileError) {
    console.log('Error searching profiles table:', profileError.message);
  }
  
  // Fallback: search through auth.users with pagination
  console.log('Searching in auth.users with pagination...');
  let page = 1;
  const perPage = 500;
  
  while (true) {
    const { data: usersPage, error: pageError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (pageError) {
      console.error('Error fetching users page', page, ':', pageError.message);
      break;
    }
    
    const users = usersPage?.users || [];
    console.log(`Page ${page}: ${users.length} users`);
    
    if (users.length === 0) {
      break;
    }
    
    const foundUser = users.find((u: any) => u.email === email);
    if (foundUser) {
      console.log('User found in auth.users:', foundUser.id);
      return { id: foundUser.id, email: foundUser.email };
    }
    
    // If we got less than perPage, we've reached the last page
    if (users.length < perPage) {
      break;
    }
    
    page++;
  }
  
  console.log('User not found by email:', email);
  return null;
}

// Check if this is an employee slot purchase
function isEmployeeSlotPurchase(payload: any): boolean {
  console.log('=== CHECKING IF EMPLOYEE SLOT PURCHASE ===');
  
  const productName = (
    payload.data?.product?.name ||
    payload.product?.name ||
    payload.data?.offer?.name ||
    payload.offer?.name ||
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

  console.log('Employee slot detection - Product name:', productName);
  console.log('Employee slot detection - Product ID:', productId);
  console.log('Employee slot detection - Price:', price);

  // Check for employee-related keywords in name
  const matchesByName = (
    productName.includes('funcionário') ||
    productName.includes('funcionario') ||
    productName.includes('employee') ||
    productName.includes('colaborador') ||
    productName.includes('sub-conta') ||
    productName.includes('subconta') ||
    productName.includes('slot') ||
    productId.includes('employee') ||
    productId.includes('funcionario') ||
    productId.includes('pkvkjyp') // ID específico do produto de funcionário
  );

  if (matchesByName) {
    console.log('=== EMPLOYEE SLOT MATCHED BY NAME/ID ===');
    return true;
  }

  // Fallback: check by price for employee slot (R$ 35.90)
  if (price > 0 && Math.abs(price - 35.90) < 1) {
    console.log('=== EMPLOYEE SLOT MATCHED BY PRICE (R$ 35.90) ===');
    return true;
  }

  console.log('=== NOT AN EMPLOYEE SLOT PURCHASE ===');
  return false;
}

// Get plan days for accumulation
function getPlanDays(plan: string): number {
  switch (plan) {
    case 'monthly': return 30;
    case 'quarterly': return 90;
    case 'annual': return 365;
    case 'lifetime': return 0; // No expiration
    default: return 365;
  }
}

// Calculate new expiration date considering existing subscription
function calculateExpirationDate(plan: string, currentExpiresAt: string | null): string | null {
  if (plan === 'lifetime') {
    return null;
  }
  
  const planDays = getPlanDays(plan);
  const now = new Date();
  
  // Determine base date: use current expiration if still valid, otherwise use today
  let baseDate: Date;
  
  if (currentExpiresAt) {
    const currentExpiration = new Date(currentExpiresAt);
    // If subscription hasn't expired yet, add days to current expiration
    baseDate = currentExpiration > now ? currentExpiration : now;
    console.log('Base date for expiration calculation:', baseDate.toISOString());
    console.log('Current expiration:', currentExpiresAt);
    console.log('Is still valid:', currentExpiration > now);
  } else {
    baseDate = now;
    console.log('No current expiration, using today as base');
  }
  
  // Add plan days to base date
  const newExpiresAt = new Date(baseDate.getTime() + planDays * 24 * 60 * 60 * 1000);
  console.log('New expiration date:', newExpiresAt.toISOString());
  console.log('Days added:', planDays);
  
  return newExpiresAt.toISOString();
}

// Determine subscription plan from Cakto payload (returns plan type only, not expiration)
function getSubscriptionPlan(payload: any): string {
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
    return 'lifetime';
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
    return 'annual';
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
    return 'monthly';
  }

  // Check for quarterly/trimestral by name
  if (
    productName.includes('trimestral') ||
    productName.includes('quarterly') ||
    productName.includes('3 meses') ||
    productName.includes('três meses') ||
    productName.includes('tres meses') ||
    productId.includes('quarterly') ||
    productId.includes('trimestral')
  ) {
    console.log('Matched: QUARTERLY by name');
    return 'quarterly';
  }

  // FALLBACK: Use price to detect plan
  // Preços atuais: Mensal R$55,90 | Trimestral R$149,00 | Anual R$479,00
  if (price > 0) {
    // Lifetime: above R$500
    if (price > 500) {
      console.log('Matched: LIFETIME by price (R$', price, ')');
      return 'lifetime';
    }
    
    // Annual: between R$250 and R$500 (preço atual R$479)
    if (price >= 250 && price <= 500) {
      console.log('Matched: ANNUAL by price (R$', price, ')');
      return 'annual';
    }
    
    // Quarterly: between R$100 and R$250 (preço atual R$149)
    if (price >= 100 && price < 250) {
      console.log('Matched: QUARTERLY by price (R$', price, ')');
      return 'quarterly';
    }
    
    // Monthly: less than R$100 (preço atual R$55,90)
    if (price < 100) {
      console.log('Matched: MONTHLY by price (R$', price, ')');
      return 'monthly';
    }
  }

  // SAFE DEFAULT: Annual (middle ground)
  console.log('WARNING: No plan pattern matched! Defaulting to ANNUAL');
  return 'annual';
}

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(phone: string, message: string, instanceName?: string): Promise<boolean> {
  console.log('=== SEND WHATSAPP MESSAGE START ===');
  console.log('Input phone:', phone);
  console.log('Instance requested:', instanceName || 'default (VendaApp)');
  
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
  // Usar instância fixa "notficacao" para notificações do sistema
  const instance = instanceName || "notficacao";

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
    case 'quarterly':
      return '3 meses';
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

// Track processed orders to prevent duplicate processing
const processedOrders = new Map<string, number>();

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
    
    // Extract order ID to detect duplicates from Cakto sending multiple webhooks for same purchase
    const orderId = payload.data?.id || payload.id || '';
    const subscriptionId = payload.data?.subscription?.id || '';
    const eventType = payload.event || '';
    const uniqueKey = `${orderId}-${subscriptionId}-${eventType}`;
    
    if (orderId) {
      const lastProcessed = processedOrders.get(uniqueKey);
      const now = Date.now();
      
      // If we processed this exact order+event within the last 60 seconds, skip it
      if (lastProcessed && (now - lastProcessed) < 60000) {
        console.log('=== DUPLICATE WEBHOOK BLOCKED (in-memory) ===');
        console.log('Order ID:', orderId);
        console.log('Event:', eventType);
        console.log('Last processed:', new Date(lastProcessed).toISOString());
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Duplicate webhook blocked',
            orderId,
            event: eventType
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Mark this order+event as processed
      processedOrders.set(uniqueKey, now);
      
      // Clean up old entries (older than 5 minutes)
      for (const [key, timestamp] of processedOrders.entries()) {
        if ((now - timestamp) > 300000) {
          processedOrders.delete(key);
        }
      }
      
      console.log('Processing webhook - Order ID:', orderId, 'Event:', eventType);
    }
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

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if this is an employee slot purchase
    if (isEmployeeSlotPurchase(payload)) {
      console.log('=== EMPLOYEE SLOT PURCHASE DETECTED ===');
      
      // Find user by email using the improved search function
      let existingUser = await findUserByEmail(supabase, customerEmail);
      
      // Fallback: try to find user by email from checkoutUrl if not found by customer email
      if (!existingUser) {
        console.log('User not found by customer email, trying checkoutUrl fallback...');
        const checkoutUrl = payload.data?.checkoutUrl || payload.checkoutUrl || '';
        const emailMatch = checkoutUrl.match(/email=([^&]+)/);
        const emailFromUrl = emailMatch ? decodeURIComponent(emailMatch[1]) : '';
        
        console.log('Email extracted from checkoutUrl:', emailFromUrl);
        
        if (emailFromUrl && emailFromUrl !== customerEmail) {
          existingUser = await findUserByEmail(supabase, emailFromUrl);
          if (existingUser) {
            console.log('Found user by checkoutUrl email:', existingUser.id, emailFromUrl);
          }
        }
      }
      
      if (!existingUser) {
        console.error('User not found for email:', customerEmail, '(also tried checkoutUrl)');
        return new Response(
          JSON.stringify({ error: 'User not found', email: customerEmail }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Found user:', existingUser.id);

      // Get current profile
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('max_employees, employees_feature_enabled')
        .eq('id', existingUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const currentMax = currentProfile?.max_employees || 0;
      const newMax = currentMax + 1;

      console.log('Incrementing max_employees:', currentMax, '->', newMax);

      // Update profile with new employee slot
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          employees_feature_enabled: true,
          max_employees: newMax 
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update employee slots' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('=== EMPLOYEE SLOT ADDED SUCCESSFULLY ===');

      // Send confirmation via WhatsApp
      if (customerPhone) {
        const confirmMessage = `✅ *Slot de Funcionário Liberado!*

Olá ${customerName || 'Cliente'}!

Seu pagamento foi confirmado e agora você pode cadastrar mais 1 funcionário no CobraFácil.

📊 *Total de slots:* ${newMax}

Acesse o menu "Funcionários" para cadastrar seu colaborador.

Obrigado pela confiança! 💚`;

        await sendWhatsAppMessage(customerPhone, confirmMessage, 'SuporteApp');
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Employee slot added',
          email: customerEmail,
          max_employees: newMax
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Regular subscription purchase flow
    // Determine subscription plan
    const plan = getSubscriptionPlan(payload);
    console.log('Subscription plan determined:', plan);

    // Check if user already exists using the improved search function
    const existingUser = await findUserByEmail(supabase, customerEmail);
    
    if (existingUser) {
      console.log('=== EXISTING USER FOUND ===');
      console.log('User ID:', existingUser.id);
      console.log('Email:', customerEmail);
      
      // Fetch current profile to check if it's a trial user
      const { data: currentProfile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_expires_at, trial_expires_at, is_active, updated_at, created_at')
        .eq('id', existingUser.id)
        .single();
      
      if (profileFetchError) {
        console.error('Error fetching current profile:', profileFetchError);
      }
      
      const now = new Date();
      const profileCreatedAt = currentProfile?.created_at ? new Date(currentProfile.created_at) : null;
      const profileUpdatedAt = currentProfile?.updated_at ? new Date(currentProfile.updated_at) : null;
      
      const minutesSinceCreation = profileCreatedAt 
        ? (now.getTime() - profileCreatedAt.getTime()) / (1000 * 60) 
        : Infinity;
      const minutesSinceProfileUpdate = profileUpdatedAt 
        ? (now.getTime() - profileUpdatedAt.getTime()) / (1000 * 60) 
        : Infinity;
      
      console.log('Current profile state:', {
        subscription_plan: currentProfile?.subscription_plan,
        subscription_expires_at: currentProfile?.subscription_expires_at,
        trial_expires_at: currentProfile?.trial_expires_at,
        is_active: currentProfile?.is_active,
        updated_at: currentProfile?.updated_at,
        created_at: currentProfile?.created_at,
        minutes_since_creation: minutesSinceCreation.toFixed(2),
        minutes_since_update: minutesSinceProfileUpdate.toFixed(2)
      });
      
      // CRITICAL: If the profile was created very recently (within 2 minutes), 
      // this is likely a duplicate webhook from Cakto (subscription_created + purchase_approved)
      // In this case, DON'T accumulate days - the user was just created with the correct subscription
      const isNewlyCreatedProfile = minutesSinceCreation < 2 && 
                                     currentProfile?.subscription_plan === plan &&
                                     currentProfile?.subscription_expires_at !== null;
      
      if (isNewlyCreatedProfile) {
        console.log('=== DUPLICATE WEBHOOK BLOCKED (newly created profile) ===');
        console.log('Profile was created', minutesSinceCreation.toFixed(2), 'minutes ago');
        console.log('Already has plan:', currentProfile?.subscription_plan);
        console.log('Already has expires_at:', currentProfile?.subscription_expires_at);
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Duplicate webhook blocked - profile just created',
            email: customerEmail,
            plan: currentProfile?.subscription_plan,
            expiresAt: currentProfile?.subscription_expires_at
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if this is a TRIAL user converting to paid
      const isTrialUser = currentProfile?.subscription_plan === 'trial' || 
                          currentProfile?.trial_expires_at !== null;
      
      // For calculating new expiration, only accumulate if this is a GENUINE renewal
      // (profile existed before and has a current valid subscription)
      let expiresAt: string | null;
      
      // Check if profile was recently updated with same plan (within 2 minutes) - another duplicate check
      const isRecentUpdate = minutesSinceProfileUpdate < 2 && 
                              currentProfile?.subscription_plan === plan;
      
      if (isRecentUpdate) {
        console.log('=== DUPLICATE WEBHOOK BLOCKED (recent update with same plan) ===');
        console.log('Profile was updated', minutesSinceProfileUpdate.toFixed(2), 'minutes ago');
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Duplicate webhook blocked - recently processed',
            email: customerEmail,
            plan: currentProfile?.subscription_plan,
            expiresAt: currentProfile?.subscription_expires_at
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Calculate expiration: accumulate only if it's a genuine renewal of an active subscription
      const hasActiveSubscription = currentProfile?.subscription_expires_at && 
                                     new Date(currentProfile.subscription_expires_at) > now &&
                                     currentProfile?.subscription_plan !== 'trial' &&
                                     minutesSinceCreation > 5; // Profile must be older than 5 minutes
      
      if (hasActiveSubscription) {
        // Genuine renewal - accumulate days
        expiresAt = calculateExpirationDate(plan, currentProfile?.subscription_expires_at);
        console.log('=== GENUINE RENEWAL - ACCUMULATING DAYS ===');
      } else {
        // New subscription, trial conversion, or expired subscription - start fresh from today
        expiresAt = calculateExpirationDate(plan, null);
        console.log('=== NEW/FIRST SUBSCRIPTION - STARTING FROM TODAY ===');
      }
      
      console.log('=== EXPIRATION CALCULATION ===');
      console.log('Plan:', plan);
      console.log('Current subscription_expires_at:', currentProfile?.subscription_expires_at);
      console.log('Has active subscription:', hasActiveSubscription);
      console.log('New expiresAt:', expiresAt);
      
      if (isTrialUser) {
        console.log('=== TRIAL TO PAID CONVERSION ===');
        console.log('Converting trial user to paid plan');
        console.log('Previous plan: trial');
        console.log('New plan:', plan);
        console.log('New expires_at:', expiresAt);
      } else {
        console.log('=== SUBSCRIPTION RENEWAL (DAYS ACCUMULATED) ===');
        console.log('Previous plan:', currentProfile?.subscription_plan);
        console.log('Previous expires_at:', currentProfile?.subscription_expires_at);
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
          'quarterly': 'Trimestral',
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
    
    // Calculate expiration for new user (no existing subscription, so use today as base)
    const newUserExpiresAt = calculateExpirationDate(plan, null);
    console.log('New user expiration date:', newUserExpiresAt);

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
          subscription_expires_at: newUserExpiresAt,
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

      console.log('Sending welcome message via acesso instance...');
      const messageSent = await sendWhatsAppMessage(customerPhone, welcomeMessage, 'acesso');
      
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
        expiresAt: newUserExpiresAt
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
