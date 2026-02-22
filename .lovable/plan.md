
# Adicionar Lista de Parcelas Pagas/Abertas na Mensagem Padrao de Cobranca

## O que muda
O cliente vai receber na mensagem de cobranca um resumo visual de quais parcelas ja foram pagas e quais estao em aberto, assim:

```
📊 STATUS DAS PARCELAS:
1️⃣ ✅ 02/01/2026 - Paga
2️⃣ ✅ 02/02/2026 - Paga
3️⃣ ❌ 02/03/2026 - Em Atraso (5d)
4️⃣ ⏳ 02/04/2026 - Em Aberto
5️⃣ ⏳ 02/05/2026 - Em Aberto
```

Essa funcionalidade ja existe no sistema, porem esta desativada por padrao. O plano envolve ativa-la e tambem disponibiliza-la nos templates customizados.

## Alteracoes

### 1. Ativar por padrao (`src/types/billingMessageConfig.ts`)
- Mudar `includeInstallmentsList: false` para `includeInstallmentsList: true` no `DEFAULT_BILLING_MESSAGE_CONFIG`

### 2. Adicionar variavel `{PARCELAS_STATUS}` nos templates customizados

**`src/types/billingMessageConfig.ts`:**
- Adicionar `{ variable: '{PARCELAS_STATUS}', description: 'Lista de parcelas pagas/abertas' }` ao array `TEMPLATE_VARIABLES`
- Adicionar `{PARCELAS_STATUS}` nos templates padrao (overdue, due_today, early) logo apos a barra de progresso

**`src/lib/messageUtils.ts`:**
- Adicionar campos `installmentDates`, `paidCount` e `paidIndices` ao `TemplateData`
- Na funcao `replaceTemplateVariables`, gerar a lista de status e substituir `{PARCELAS_STATUS}`

### 3. Passar dados de parcelas nos templates customizados

**`src/components/SendOverdueNotification.tsx`:**
- Adicionar `installmentDates`, `paidCount` e `paidIndices` ao objeto passado para `replaceTemplateVariables`

**`src/components/SendDueTodayNotification.tsx`:**
- Mesmo ajuste

**`src/components/SendEarlyNotification.tsx`:**
- Mesmo ajuste

## Secao Tecnica

### Arquivos modificados (5):
1. `src/types/billingMessageConfig.ts` - Default `includeInstallmentsList: true` + variavel `{PARCELAS_STATUS}` + templates padrao atualizados
2. `src/lib/messageUtils.ts` - `TemplateData` com novos campos + substituicao de `{PARCELAS_STATUS}`
3. `src/components/SendOverdueNotification.tsx` - Passar dados de parcelas no `replaceTemplateVariables`
4. `src/components/SendDueTodayNotification.tsx` - Mesmo
5. `src/components/SendEarlyNotification.tsx` - Mesmo

### Nenhuma alteracao de banco de dados necessaria
Os dados de `installmentDates`, `paidCount` e `paidIndices` ja sao passados pelos componentes - so nao eram repassados para a funcao de templates customizados.
