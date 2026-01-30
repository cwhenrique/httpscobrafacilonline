
# Plano: Corrigir Contratos Históricos com Juros

## ✅ IMPLEMENTADO

### Alteração 1: Salvar APENAS a data de HOJE no installment_dates (Criação)
**Status:** ✅ Concluído

Nas funções `handleSubmit` e `handleDailySubmit`, ao criar contrato com juros históricos, agora o `installment_dates` contém APENAS a data de hoje:

```typescript
const updatedDates = [todayStr]; // APENAS a data de hoje, não as datas passadas
```

### Alteração 2: getCardStyle para garantir roxo ANTES da verificação de atraso
**Status:** ✅ Concluído

Movemos a verificação de `isHistoricalInterestContract` para ANTES da lógica de `isOverdue`, garantindo que o card fique roxo independente do status de atraso:

```typescript
// 🆕 Contratos históricos com juros ficam ROXOS SEMPRE (não vermelhos)
// Verificar ANTES da lógica de isOverdue para garantir cor roxa
if (isHistoricalInterestContract && !isPaid) {
  return 'bg-purple-500/20 border-purple-400 dark:bg-purple-500/30 dark:border-purple-400';
}
```

### Alteração 3: Ajustar lógica de rollamento para contratos históricos
**Status:** ✅ Concluído

Quando o usuário paga juros de um contrato histórico, agora usamos a data de HOJE como base para rolar:

```typescript
if (isHistoricalInterestContract) {
  const todayDate = new Date();
  todayDate.setHours(12, 0, 0, 0);
  
  let nextDate: Date;
  if (loan.payment_type === 'weekly') {
    nextDate = new Date(todayDate);
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (loan.payment_type === 'biweekly') {
    nextDate = new Date(todayDate);
    nextDate.setDate(nextDate.getDate() + 15);
  } else {
    nextDate = addMonths(todayDate, 1);
  }
  
  // APENAS a próxima data, não rolar datas antigas
  newInstallmentDates = [format(nextDate, 'yyyy-MM-dd')];
}
```

### Alteração 4: getLoanStatus já estava correta
**Status:** ✅ Já funcionava

A lógica do `getLoanStatus` já estava preparada para contratos históricos - verifica se há datas >= hoje e só marca como atrasado se `today > nextValidDateObj`.

## Fluxo Corrigido

### Criação de contrato histórico:
1. Usuário define data início: 30/01/2025
2. Sistema detecta 12 meses passados
3. Usuário seleciona todas as parcelas de juros
4. Sistema registra 12 pagamentos de `[INTEREST_ONLY_PAYMENT]`
5. ✅ **NOVO:** `installment_dates = ["2026-01-30"]` (só hoje)
6. ✅ `due_date = "2026-01-30"`
7. ✅ Card aparece ROXO, vencimento = 30/01/2026, não está atrasado

### Pagamento de juros da parcela de hoje:
1. Usuário registra pagamento de juros
2. Sistema detecta `[HISTORICAL_INTEREST_CONTRACT]`
3. ✅ **NOVO:** Usa data de HOJE como base: `2026-01-30 + 1 mês = 2026-02-28`
4. ✅ `installment_dates = ["2026-02-28"]`
5. ✅ `due_date = "2026-02-28"`
6. ✅ Card continua ROXO, vencimento = 28/02/2026

## Arquivos Modificados

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/pages/Loans.tsx` | 3031-3043 | handleDailySubmit - salvar só data de hoje |
| `src/pages/Loans.tsx` | 3639-3651 | handleSubmit - salvar só data de hoje |
| `src/pages/Loans.tsx` | 5012-5051 | handleRenegotiateConfirm - usar data atual para rolar |
| `src/pages/Loans.tsx` | 7845-7859 | getCardStyle (regular) - roxo antes de atraso |
| `src/pages/Loans.tsx` | 9977-9984 | getCardStyle (daily) - roxo antes de atraso |

## Testes Recomendados

1. ✅ Criar novo contrato histórico com 12 meses de juros → verificar que installment_dates tem só 1 data
2. ✅ Verificar que o card é ROXO e não vermelho
3. ✅ Verificar que "Venc:" mostra data de hoje (30/01/2026)
4. ✅ Verificar que NÃO aparece badge "Atrasado"
5. ✅ Registrar pagamento de juros → verificar que próximo vencimento é 28/02/2026
6. ✅ Verificar que o card continua ROXO
7. ⚠️ Testar com contrato semanal e quinzenal também (lógica implementada, precisa testar)
