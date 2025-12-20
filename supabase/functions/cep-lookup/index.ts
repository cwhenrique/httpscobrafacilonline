import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cep } = await req.json();
    
    if (!cep || typeof cep !== 'string') {
      console.error('CEP não fornecido ou inválido');
      return new Response(
        JSON.stringify({ error: 'CEP é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      console.error('CEP deve ter 8 dígitos:', cleanCep);
      return new Response(
        JSON.stringify({ error: 'CEP deve ter 8 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Buscando CEP:', cleanCep);
    
    // Tentar BrasilAPI primeiro (mais confiável)
    let data = null;
    
    try {
      console.log('Tentando BrasilAPI...');
      const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      if (brasilApiResponse.ok) {
        const brasilData = await brasilApiResponse.json();
        console.log('Resposta BrasilAPI:', JSON.stringify(brasilData));
        
        // Converter formato BrasilAPI para formato ViaCEP
        data = {
          cep: brasilData.cep,
          logradouro: brasilData.street || '',
          bairro: brasilData.neighborhood || '',
          localidade: brasilData.city || '',
          uf: brasilData.state || '',
        };
      }
    } catch (e) {
      console.log('BrasilAPI falhou, tentando ViaCEP...', e);
    }
    
    // Fallback para ViaCEP se BrasilAPI falhar
    if (!data) {
      try {
        const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (viaCepResponse.ok) {
          data = await viaCepResponse.json();
          console.log('Resposta ViaCEP:', JSON.stringify(data));
        }
      } catch (e) {
        console.log('ViaCEP também falhou:', e);
      }
    }
    
    if (!data) {
      console.error('Ambas as APIs falharam');
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar CEP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na função cep-lookup:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao buscar CEP' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
