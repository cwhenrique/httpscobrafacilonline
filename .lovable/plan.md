

## Problema: Relatórios não chegam no horário agendado

### Diagnóstico

Analisei os cron jobs, a edge function `daily-summary`, o webhook `umclique-webhook`, e os dados de `pending_messages`. A função está sendo chamada corretamente pelos crons nos horários certos. O problema é o **fluxo de confirmação obrigatório**.

O fluxo atual para TODOS os assinantes pagantes:
1. Cron dispara `daily-summary` no horário configurado
2. Relatório é salvo em `pending_messages` com status "pending"
3. Um template "relatorio" é enviado ao usuário perguntando se quer receber
4. Usuário precisa responder "sim" para receber o relatório real
5. O webhook `umclique-webhook` processa a resposta e entrega o conteúdo

**Evidência nos dados**: Dos ~20 assinantes ativos hoje, a maioria tem mensagens em status "pending" (nunca confirmaram). Apenas 5-6 confirmaram e receberam. Os templates estão sendo enviados, mas os usuários não respondem.

**Problema secundário**: O dedup (anti-duplicação) bloqueia o envio agendado se já existe uma pending_message daquele dia, mesmo que tenha sido criada por uma solicitação on-demand via webhook em horário diferente.

### Solução

Para assinantes pagantes (`relatorio_ativo = true`), enviar o relatório **diretamente** sem exigir confirmação. O template fica apenas como abertura de janela de conversa, seguido imediatamente pelo conteúdo.

### Alterações

#### 1. `supabase/functions/daily-summary/index.ts` — Envio direto para assinantes
Modificar a função `sendWhatsAppViaUmClique` para aceitar um parâmetro `directSend`. Quando `directSend = true`:
- Ainda salva em `pending_messages` (para auditoria)
- Envia o template para abrir a janela de conversa
- Aguarda 2 segundos
- Envia o conteúdo do relatório como texto logo em seguida
- Marca como `confirmed` + `sent_at` automaticamente

Na chamada principal (linha 783-784), quando `relatorio_ativo = true` E NÃO é teste manual, passar `directSend: true`.

#### 2. Corrigir dedup para não bloquear envios agendados
Ajustar a lógica de dedup para considerar a hora do envio. Se já existe uma pending de outro horário (ex: on-demand), não bloquear o agendado. Alternativa mais simples: o dedup só bloqueia se existe pending da mesma `targetHour`.

#### 3. `supabase/functions/umclique-webhook/index.ts` — Manter fluxo on-demand
O webhook continua funcionando para solicitações on-demand (quando usuário envia "relatorio"). Quando confirma e já existe pending com conteúdo, entrega normalmente. Sem alterações necessárias.

### Detalhes técnicos

- O template "relatorio" é necessário para abrir a janela de 24h da Meta. Enviamos template → esperamos 2s → enviamos texto.
- O dedup atual usa `created_at >= brtMidnight AND status = 'pending'`. Precisamos ajustar para não bloquear quando é um horário diferente.
- Fluxo para não-assinantes (UAZAPI) não muda — já é direto.

