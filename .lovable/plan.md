

## Plano Completo de Reducao de Custos - Implementacao

Este plano implementa todas as etapas de otimizacao para reduzir ~88% das execucoes de cron jobs (de ~330 para ~39 por dia).

---

### Etapa 1: Reduzir `check-expired-subscriptions` de 24x para 2x/dia

**O que muda:** A verificacao de assinaturas expiradas passa de a cada hora para 2x/dia (08:00 e 20:00 BRT).

**Acoes:**
1. Deletar o cron job `check-expired-subscriptions-hourly` (schedule: `0 * * * *`)
2. Criar 2 novos cron jobs:
   - `check-expired-subs-morning` as 11:00 UTC (08:00 BRT)
   - `check-expired-subs-evening` as 23:00 UTC (20:00 BRT)

**Impacto no usuario:** Atraso maximo de ~12h para desativar conta expirada (antes era 1h). Na pratica, imperceptivel.

**Economia:** 24 -> 2 execucoes/dia (-22)

---

### Etapa 2: Reduzir `check-trial-expiring` de 24x para 3x/dia

**O que muda:** A verificacao de trials expirando passa de horaria para 3x/dia, com janela de deteccao ampliada de 2-3h para 0-8h.

**Acoes:**
1. Alterar a edge function `check-trial-expiring` para usar janela de 0-8h ao inves de 2-3h
2. Deletar o cron job `check-trial-expiring-hourly` (schedule: `0 * * * *`)
3. Criar 3 novos cron jobs:
   - `check-trial-expiring-morning` as 11:00 UTC (08:00 BRT)
   - `check-trial-expiring-afternoon` as 17:00 UTC (14:00 BRT)
   - `check-trial-expiring-evening` as 23:00 UTC (20:00 BRT)

**Impacto no usuario:** Usuarios de trial ainda recebem aviso antes da expiracao, apenas com horarios fixos ao inves de a cada hora.

**Economia:** 24 -> 3 execucoes/dia (-21)

---

### Etapa 3: Otimizar `daily-summary` (MAIOR IMPACTO)

**O que muda:** O batchSize aumenta de 3 para 30 usuarios por execucao, reduzindo de 270 para 27 cron jobs.

**Acoes:**
1. Alterar o batchSize padrao na edge function `daily-summary` de 3 para 30
2. Deletar todos os 270 cron jobs existentes (prefixo `ds-h`)
3. Criar 27 novos cron jobs (para cada hora de envio: h7, h8, h9, h10, h11, h12, h13, h14, h15, h16, h17, h18 - variando conforme horarios existentes, com batches de 0 a N ajustados)

**Nota importante:** Os cron jobs atuais cobrem 2 horarios (h7 e h12) com 135 batches cada. Com batchSize=30, precisaremos de ~14 batches por horario = 28 cron jobs total.

**Impacto no usuario:** Nenhum. Os relatorios continuam chegando nos mesmos horarios.

**Economia:** 270 -> 28 execucoes/dia (-242)

---

### Etapa 4: Otimizar `auto-client-billing`

**O que muda:** O batchSize aumenta de 3 para 30 e batches multiplos por horario sao consolidados.

**Acoes:**
1. Alterar o batchSize padrao na edge function de 3 para 30
2. Deletar os 12 cron jobs existentes
3. Criar 7 novos cron jobs (1 por horario: 7h, 8h, 9h, 10h, 12h, 14h, 16h, 18h com batch=0 e batchSize=30)

**Impacto no usuario:** Nenhum. As cobranças continuam sendo enviadas nos mesmos horarios.

**Economia:** 12 -> 8 execucoes/dia (-4)

---

### Etapa 5 (Opcional): Remover WhatsApp de `check-trial-expiring` e `check-subscription-expiring`

**O que muda:** Essas funcoes deixam de enviar WhatsApp, ficando mais rapidas e baratas.

**Impacto no usuario:**
- `check-trial-expiring`: Usuarios de trial NAO receberao mais aviso de 3h antes da expiracao via WhatsApp
- `check-subscription-expiring`: Usuarios NAO receberao mais aviso de 2 dias antes da expiracao via WhatsApp

**Recomendacao:** Implementar apenas se o custo justificar, ja que essas notificacoes ajudam na retencao.

---

### Resumo da Economia

| Funcao | Antes (exec/dia) | Depois (exec/dia) | Reducao |
|--------|-------------------|---------------------|---------|
| daily-summary | 270 | 28 | -242 (90%) |
| check-expired-subscriptions | 24 | 2 | -22 (92%) |
| check-trial-expiring | 24 | 3 | -21 (88%) |
| auto-client-billing | 12 | 8 | -4 (33%) |
| **TOTAL** | **330** | **41** | **~88%** |

---

### Detalhes Tecnicos

**Arquivos a serem alterados:**
- `supabase/functions/check-trial-expiring/index.ts` - Ampliar janela de deteccao de 2-3h para 0-8h
- `supabase/functions/daily-summary/index.ts` - Alterar batchSize padrao de 3 para 30 (linha 125)
- `supabase/functions/auto-client-billing/index.ts` - Alterar batchSize padrao de 3 para 30 (linha 216)

**SQL a executar (via insert tool, nao migration):**
1. Deletar todos os cron jobs antigos: `SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'ds-h%' OR jobname LIKE 'auto-client-billing%' OR jobname = 'check-expired-subscriptions-hourly' OR jobname = 'check-trial-expiring-hourly'`
2. Criar os novos cron jobs com batchSize=30 e frequencias reduzidas

**Ordem de implementacao:**
1. Etapa 1 (check-expired-subscriptions) - rapida, sem risco
2. Etapa 2 (check-trial-expiring) - requer alteracao de codigo
3. Etapa 4 (auto-client-billing) - simples
4. Etapa 3 (daily-summary) - maior impacto, mais cron jobs para recriar

