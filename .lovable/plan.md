

# Plano: Corrigir Lista de Usuários para Exibir Todos (>1000)

## Problema Identificado

O usuário `giovanialvez8@gmail.com` não aparece na lista porque:

1. **Total de usuários no banco:** 1.086
2. **Limite retornado pela API:** 1.000 (limite padrão do Supabase)
3. **Usuários criados depois dele:** 1.014

Como a lista é ordenada por data de criação decrescente (mais recentes primeiro), ele está na posição ~1015, fora do corte dos 1000.

## Causa Raiz

O Supabase tem um **limite máximo padrão de 1000 linhas** por query, independentemente do valor passado no `.limit()`. Mesmo especificando `limit(10000)`, o resultado é truncado em 1000.

## Solução

Usar **paginação com `.range()`** na edge function para buscar todos os usuários em lotes.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/list-trial-users/index.ts` | Implementar busca paginada com range() |

## Alterações Detalhadas

### `supabase/functions/list-trial-users/index.ts`

Modificar para buscar usuários em lotes de 1000:

```typescript
// Buscar em lotes para contornar limite de 1000 do Supabase
const PAGE_SIZE = 1000;
let allUsers: any[] = [];
let offset = 0;
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, phone, temp_password, trial_expires_at, is_active, subscription_plan, subscription_expires_at, created_at, affiliate_email')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw error;

  if (data && data.length > 0) {
    allUsers = [...allUsers, ...data];
    offset += PAGE_SIZE;
    hasMore = data.length === PAGE_SIZE;
  } else {
    hasMore = false;
  }
}

console.log(`Found ${allUsers.length} users`);
return new Response(JSON.stringify({ success: true, users: allUsers }), ...);
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| "Todos os Usuários (1000)" | "Todos os Usuários (1086)" |
| giovanialvez8@gmail.com não aparece | giovanialvez8@gmail.com aparece na busca |

## Seção Técnica

### Por que `.range()` em vez de `.limit()`?

O Supabase/PostgREST tem um limite de resposta padrão de 1000 linhas configurado no servidor. A função `.limit()` é limitada por esse máximo. Usar `.range(start, end)` permite paginar e buscar em lotes.

### Código Completo

```typescript
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

    // Fetch all users using pagination to bypass 1000 row limit
    const PAGE_SIZE = 1000;
    let allUsers: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, phone, temp_password, trial_expires_at, is_active, subscription_plan, subscription_expires_at, created_at, affiliate_email')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allUsers = [...allUsers, ...data];
        offset += PAGE_SIZE;
        // If we got less than PAGE_SIZE, we've reached the end
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allUsers.length} users (fetched in ${Math.ceil(offset / PAGE_SIZE)} batches)`);

    return new Response(
      JSON.stringify({ success: true, users: allUsers }),
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
```

