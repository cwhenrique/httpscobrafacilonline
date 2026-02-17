

## Plano de Redução de Custos do Lovable Cloud (~60% de economia)

### Diagnóstico Atual (286 cron jobs ativos)

| Função | Cron Jobs | Execuções/dia | Problema |
|--------|-----------|---------------|----------|
| `daily-summary` | 270 | 270 | batchSize=3, gerando 270 chamadas/dia |
| `auto-client-billing` | 12 | ~72/semana (~12/dia) | batchSize=3, múltiplos horários |
| `check-expired-subscriptions` | 1 | 24 (a cada hora) | Excessivo para verificar expiração |
| `check-trial-expiring` | 1 | 24 (a cada hora) | Excessivo para verificar trial |
| `check-subscription-expiring` | 1 | 1 | OK |
| `weekly-summary` | 1 | ~0.14 (1x/semana) | OK |
| **WhatsApp webhooks** | — | ~milhares | Acionados externamente |

**Total estimado: ~330+ execuções de edge functions/dia só de cron jobs**

---

### Etapa 1: Otimizar `daily-summary` (270 → ~27 cron jobs) — **MAIOR IMPACTO**

**Problema:** batchSize=3 com 270 cron jobs para ~864 usuários ativos.
**Solução:** Aumentar batchSize de 3 para 30 usuários por execução.

- **Antes:** 270 cron jobs × 1 execução = 270 execuções/dia
- **Depois:** 27 cron jobs × 1 execução = 27 execuções/dia
- **Economia:** ~243 execuções/dia (~90% de redução nesta função)

**Ações:**
1. Alterar a edge function `daily-summary` para processar batchSize=30
2. Deletar os 270 cron jobs antigos
3. Criar 27 novos cron jobs com batchSize=30
4. Testar para garantir que não ocorra timeout

---

### Etapa 2: Otimizar `auto-client-billing` (12 → 7 cron jobs)

**Problema:** batchSize=3 com múltiplos batches para alguns horários.
**Solução:** Aumentar batchSize para 30 e usar 1 job por horário.

- **Antes:** 12 cron jobs × 6 dias = 72 execuções/semana
- **Depois:** 7 cron jobs × 6 dias = 42 execuções/semana
- **Economia:** ~30 execuções/semana

**Ações:**
1. Alterar a edge function para suportar batchSize=30
2. Deletar os 12 cron jobs antigos
3. Criar 7 novos (1 por horário: 7h, 8h, 9h, 10h, 12h, 14h, 16h, 18h)

---

### Etapa 3: Reduzir `check-expired-subscriptions` (24x → 2x/dia)

**Problema:** Verifica expiração a cada hora — desnecessário.
**Solução:** Executar 2x/dia (08:00 e 20:00 BRT).

- **Antes:** 24 execuções/dia
- **Depois:** 2 execuções/dia
- **Economia:** 22 execuções/dia

**Ações:**
1. Deletar o cron job hourly atual
2. Criar 2 novos cron jobs (11:00 UTC e 23:00 UTC)

---

### Etapa 4: Reduzir `check-trial-expiring` (24x → 3x/dia)

**Problema:** Verifica a cada hora se trials expiram em 3h.
**Solução:** Executar 3x/dia (08:00, 14:00 e 20:00 BRT) e ampliar a janela de detecção.

- **Antes:** 24 execuções/dia
- **Depois:** 3 execuções/dia
- **Economia:** 21 execuções/dia

**Ações:**
1. Alterar a janela de detecção de 2-3h para 0-8h
2. Deletar o cron job hourly
3. Criar 3 novos cron jobs

---

### Etapa 5: Remover notificação WhatsApp de `check-trial-expiring` e `check-subscription-expiring` (OPCIONAL)

Seguindo o mesmo padrão já aplicado ao `check-expired-subscriptions`, podemos remover o envio de WhatsApp dessas funções para reduzir tempo de execução e dependências externas. A notificação pode ser feita de forma centralizada por outra função.

---

### Resumo da Economia

| Função | Antes (exec/dia) | Depois (exec/dia) | Redução |
|--------|-------------------|---------------------|---------|
| `daily-summary` | 270 | 27 | -243 (90%) |
| `auto-client-billing` | ~12 | ~7 | -5 (42%) |
| `check-expired-subscriptions` | 24 | 2 | -22 (92%) |
| `check-trial-expiring` | 24 | 3 | -21 (88%) |
| **TOTAL cron** | **~330** | **~39** | **~88%** |

**Redução total de execuções cron: ~88%**
**Economia estimada em custos Cloud: ~60%+** (considerando que webhooks WhatsApp são acionados externamente e não podem ser reduzidos aqui)

---

### Ordem de Implementação Recomendada

1. ✅ ~~Remover WhatsApp do `check-expired-subscriptions`~~ (já feito)
2. 🔲 Etapa 3: Reduzir `check-expired-subscriptions` para 2x/dia
3. 🔲 Etapa 4: Reduzir `check-trial-expiring` para 3x/dia
4. 🔲 Etapa 1: Otimizar `daily-summary` (maior impacto, mais complexo)
5. 🔲 Etapa 2: Otimizar `auto-client-billing`
6. 🔲 Etapa 5: Remover WhatsApp das demais funções (opcional)
