

## Diagnóstico: Relatório preso como "pending" — nunca enviado

### Causa Raiz

A lógica de deduplicação pós-insert (linhas 136-158) está bloqueando envios legítimos:

1. O cron das 10h BRT cria uma `pending_message` (de3dfb1c) às 13:01 UTC
2. O template É enviado, mas o `directSend` (envio do texto) aparentemente falha ou a função termina antes de completar
3. A mensagem fica travada com `status = 'pending'` para sempre
4. Quando o cron (ou teste manual) tenta reenviar, insere nova mensagem MAS o guard pós-insert encontra a mensagem antiga de3dfb1c (que é mais velha → "primeira"), deleta a nova e retorna `true` **sem enviar nada**
5. Resultado: mensagem órfã bloqueia todas as tentativas futuras naquele dia

Há também 5 mensagens pendentes acumuladas (3 de ontem que nunca expiraram + 2 de hoje).

### Correção em `supabase/functions/daily-summary/index.ts`

**1) Limpar mensagens pendentes antigas antes de processar** (antes da linha 90):
```typescript
// Limpar mensagens pendentes antigas (>1h) que nunca foram confirmadas
await supabase
  .from('pending_messages')
  .update({ status: 'expired' })
  .eq('user_id', userId)
  .eq('message_type', 'daily_report')
  .eq('status', 'pending')
  .lt('created_at', new Date(now.getTime() - 60 * 60 * 1000).toISOString());
```

**2) Guard pós-insert: restringir janela para 60 segundos** (linha 143):
Trocar `.gte('created_at', todayStartUTC.toISOString())` por `.gte('created_at', new Date(now.getTime() - 60000).toISOString())` — apenas detecta corridas paralelas reais, não mensagens de horas atrás.

**3) Quando `force=true`, pular guard pós-insert inteiramente** (linha 146):
Adicionar `&& !force` na condição para que o modo forçado nunca seja bloqueado.

**4) Limpar dados órfãos atuais deste usuário** via insert tool:
```sql
UPDATE pending_messages SET status = 'expired' 
WHERE user_id = '3cffea17-6b8f-4423-9756-6bdd41868f2b' 
  AND status = 'pending' AND message_type = 'daily_report';
```

### Arquivos
- `supabase/functions/daily-summary/index.ts` — ajustar dedup + cleanup
- Operação de dados para limpar mensagens órfãs existentes

