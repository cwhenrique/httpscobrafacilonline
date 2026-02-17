

## Remover envio de notificacao WhatsApp da funcao check-expired-subscriptions

A funcao `check-expired-subscriptions` atualmente faz duas coisas:
1. Desativa usuarios com assinatura expirada (muda `is_active` para `false`)
2. Envia notificacao WhatsApp avisando sobre a expiracao

O plano e remover toda a parte de envio de WhatsApp, mantendo apenas a logica de desativacao.

### O que sera removido:
- Funcao `sendWhatsApp` e funcoes auxiliares (`cleanApiUrl`)
- Bloco de envio de mensagem WhatsApp dentro do loop de usuarios
- Delay de 1 segundo entre mensagens (que so existia por causa do WhatsApp)

### O que sera mantido:
- Busca de usuarios com assinatura expirada
- Desativacao do usuario (`is_active = false`)
- Logs e resposta JSON

### Detalhes tecnicos:
- Arquivo: `supabase/functions/check-expired-subscriptions/index.ts`
- Serao removidas as funcoes `cleanApiUrl` e `sendWhatsApp` (linhas 11-60)
- Sera removido o bloco que monta a mensagem e chama `sendWhatsApp` (linhas 107-131)
- Sera removido o `await new Promise(resolve => setTimeout(resolve, 1000))` (linha 133)
- Os campos `phone` e `full_name` podem ser removidos do SELECT ja que nao serao mais usados para mensagem

