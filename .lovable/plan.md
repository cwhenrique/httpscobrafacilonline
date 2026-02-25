

# Template de Relatório Sendo Enviado em Duplicata

## Diagnóstico

Analisando a tabela `pending_messages`, confirmei que usuários com `relatorio_ativo=true` estão recebendo **duas inserções** (e dois templates) no mesmo horário:

| Usuário | Timestamps | Diferença |
|---|---|---|
| `5dfd21d1` | 21:01:01, 21:01:02 | 1 segundo |
| `8f0911fe` | 21:02:01, 21:02:02 | 1 segundo |

A causa raiz: o `pg_cron` + `pg_net` pode executar a mesma chamada HTTP duas vezes (retry automático em timeout ou latência). A função `sendWhatsAppViaUmClique` **não verifica** se já existe um `pending_messages` para aquele usuário no dia antes de inserir e enviar o template.

## Solução

Adicionar **deduplicação** na função `sendWhatsAppViaUmClique` dentro de `supabase/functions/daily-summary/index.ts`:

### Alteração (linhas 73-91)

Antes de inserir na `pending_messages` e enviar o template, verificar se já existe um registro `daily_report` para aquele `user_id` criado hoje:

```typescript
// Check for existing pending message today to prevent duplicate templates
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const { data: existing } = await supabase
  .from('pending_messages')
  .select('id')
  .eq('user_id', userId)
  .eq('message_type', 'daily_report')
  .gte('created_at', todayStart.toISOString())
  .limit(1);

if (existing && existing.length > 0) {
  console.log(`Skipping duplicate template for user ${userId} - already sent today`);
  return true; // Already sent, skip
}

// Then proceed with insert + template send...
```

Isso garante que, independentemente de quantas vezes a função seja chamada (retry do pg_net, batches sobrepostos, etc.), cada usuário recebe **apenas um** template por dia.

## Arquivo Alterado

| Arquivo | Alteração |
|---|---|
| `supabase/functions/daily-summary/index.ts` | Adicionar verificação de duplicata antes de inserir em `pending_messages` e enviar template |

