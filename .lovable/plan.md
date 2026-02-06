
# Plano: Cancelar PWA Push e Manter Relatórios WhatsApp

## Resumo

O sistema de **relatórios via WhatsApp já está funcionando** corretamente. Vou remover a implementação de PWA Push Notifications que foi adicionada, mantendo o sistema existente de notificações via WhatsApp.

---

## Situação Atual

### O que já está funcionando (WhatsApp):

| Horário | Função | Descrição |
|---------|--------|-----------|
| 7h (10h UTC) | `morning-greeting` | Saudação matinal com resumo rápido |
| 8h (11h UTC) | `daily-summary` | Relatório detalhado dos empréstimos |
| 12h (15h UTC) | `daily-summary` | Lembrete com cobranças pendentes |

Os cron jobs já estão configurados com batches para processar múltiplos usuários.

### O que será removido (PWA Push):

| Item | Arquivo |
|------|---------|
| Componente UI | `src/components/PushNotificationSettings.tsx` |
| Hook | `src/hooks/usePushNotifications.ts` |
| Service Worker | `public/sw-push.js` |
| Edge Function | `supabase/functions/send-push-notification/index.ts` |
| Edge Function | `supabase/functions/get-vapid-public-key/index.ts` |
| Tabela DB | `push_subscriptions` |
| Import no Settings | Remover referência em Settings.tsx |

---

## Alterações

### 1. Remover arquivos PWA Push

**Arquivos a deletar:**
- `src/components/PushNotificationSettings.tsx`
- `src/hooks/usePushNotifications.ts`
- `public/sw-push.js`
- `supabase/functions/send-push-notification/index.ts`
- `supabase/functions/get-vapid-public-key/index.ts`

### 2. Atualizar Settings.tsx

Remover o import e uso do `PushNotificationSettings`:

```typescript
// REMOVER esta linha:
import { PushNotificationSettings } from '@/components/PushNotificationSettings';

// REMOVER este componente do JSX:
<PushNotificationSettings />
```

### 3. Limpar Tabela do Banco

A tabela `push_subscriptions` será removida via migration.

### 4. Atualizar config.toml

Remover as entradas:
- `[functions.send-push-notification]`
- `[functions.get-vapid-public-key]`

---

## Sistema de Relatórios WhatsApp (Mantido)

O sistema atual funciona assim:

1. **Usuário conecta WhatsApp** na página de Perfil
2. **Cron jobs** rodam automaticamente às 8h e 12h
3. **Edge Function `daily-summary`** busca:
   - Empréstimos em aberto (`status: pending/overdue`)
   - Veículos e produtos pendentes
   - Calcula valores vencendo hoje e em atraso
4. **Mensagem enviada** para o próprio número do usuário

### Mensagem de exemplo (8h):

```
📋 *Relatório do Dia*
📅 06/02/2026
━━━━━━━━━━━━━━━━

⏰ *VENCE HOJE:* R$ 1.500,00
• João Silva - R$ 500
• Maria Santos - R$ 1.000

🚨 *EM ATRASO:* R$ 2.000,00
• Pedro Alves (3 dias) - R$ 800
• Ana Costa (7 dias) - R$ 1.200

━━━━━━━━━━━━━━━━
💰 Total Pendente: R$ 3.500,00
```

---

## Resumo Final

| Ação | Descrição |
|------|-----------|
| ❌ Deletar | 5 arquivos de PWA Push |
| ❌ Remover | Tabela `push_subscriptions` |
| ❌ Limpar | Referencias em Settings.tsx |
| ✅ Manter | Sistema de relatórios WhatsApp (8h e 12h) |
| ✅ Manter | Todas as Edge Functions de WhatsApp |
| ✅ Manter | Cron jobs configurados |

O sistema de notificações continuará funcionando via WhatsApp como antes, sem necessidade de PWA Push.
