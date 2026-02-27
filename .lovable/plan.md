

## Problema: Webhook envia template duplicado ao confirmar

Quando o usuário clica em "Receber relatório", o webhook (`umclique-webhook/index.ts`) encontra a `pending_message` e nas **linhas 230-245** envia **outro template** antes de enviar o conteúdo. Isso é desnecessário — o usuário acabou de responder ao primeiro template, então a janela de 24h da Meta já está aberta.

### Correção

**Arquivo: `supabase/functions/umclique-webhook/index.ts`** (linhas 210-278)

Remover o envio do template no fluxo de confirmação. Quando há `pending_message`, enviar **apenas o conteúdo do relatório** diretamente, sem template intermediário:

```typescript
// ANTES (linhas 230-257):
// Step 1: Sending template to open conversation window  ← ERRADO, janela já aberta
// Step 2: Wait 2s
// Step 3: Send report text

// DEPOIS:
// Enviar apenas o texto do relatório (janela já aberta pela resposta do usuário)
```

Especificamente:
1. Remover o bloco de envio de template (linhas 230-254) e o delay de 2s (linha 257)
2. Manter apenas o envio do texto do relatório (linhas 260-278)

Isso resolve o loop onde cada confirmação gerava um novo template pedindo confirmação novamente.

