import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting check for expired pending messages...');

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find and update expired messages
    const { data: expiredMessages, error: selectError } = await supabase
      .from('pending_messages')
      .select('id, client_name, user_id')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (selectError) {
      console.error('Error fetching expired messages:', selectError);
      throw selectError;
    }

    if (!expiredMessages || expiredMessages.length === 0) {
      console.log('No expired messages found');
      return new Response(
        JSON.stringify({ success: true, expiredCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredMessages.length} expired messages`);

    // Update status to expired
    const expiredIds = expiredMessages.map(m => m.id);
    const { error: updateError } = await supabase
      .from('pending_messages')
      .update({ status: 'expired' })
      .in('id', expiredIds);

    if (updateError) {
      console.error('Error updating expired messages:', updateError);
      throw updateError;
    }

    // Optionally notify users about expired messages
    // Group by user_id to send one notification per user
    const userExpiredCounts: Record<string, { count: number; names: string[] }> = {};
    for (const msg of expiredMessages) {
      if (!userExpiredCounts[msg.user_id]) {
        userExpiredCounts[msg.user_id] = { count: 0, names: [] };
      }
      userExpiredCounts[msg.user_id].count++;
      userExpiredCounts[msg.user_id].names.push(msg.client_name);
    }

    // Create notifications for users
    for (const [userId, data] of Object.entries(userExpiredCounts)) {
      const clientNames = data.names.slice(0, 3).join(', ');
      const moreCount = data.count > 3 ? ` e mais ${data.count - 3}` : '';
      
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Mensagens expiradas',
        message: `${data.count} mensagem(ns) expiraram sem confirmação: ${clientNames}${moreCount}`,
        type: 'warning',
      });
    }

    console.log(`Marked ${expiredMessages.length} messages as expired`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiredCount: expiredMessages.length,
        usersNotified: Object.keys(userExpiredCounts).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in check-expired-pending-messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
