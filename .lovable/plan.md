
# Plano: Corrigir Contratos Históricos com Juros

## Problemas Identificados

### Problema 1: Badge "Atrasado" aparece incorretamente
O sistema está marcando o empréstimo como atrasado porque:
- `getPaidInstallmentsCount()` retorna 0 (não conta pagamentos de juros como "parcelas pagas")
- A primeira data em `installment_dates` é de 2025 (data histórica)
- A lógica de `getLoanStatus` verifica a próxima parcela não paga, que é a data de 2025
- Resultado: considera atrasado porque `today > 2025-01-30`

### Problema 2: Data rolando para 2025 em vez de 2026
Quando o usuário registra pagamento de juros:
- O código busca `currentDates` que contém `["2025-01-30", "2025-02-28", ..., "2026-01-30"]`
- Aplica `addMonths()` em TODAS as datas: `2025-01-31 + 1 mês = 2025-02-28`
- `paidInstallmentsCount = 0` então `finalDueDate = finalDates[0] = 2025-02-28`

## Causa Raiz

Para contratos com juros históricos, as datas passadas estão sendo salvas em `installment_dates`, mas elas deveriam ser APENAS para registro. O vencimento real do contrato (principal) deveria ser HOJE, com apenas UMA data no array.

## Solução

### Alteração 1: Salvar APENAS a data de HOJE no installment_dates (Criação)

**Arquivos:** `src/pages/Loans.tsx` 

Nas funções `handleSubmit` e `handleDailySubmit`, ao criar contrato com juros históricos:

```typescript
// ANTES (errado):
const historicalDates = selectedHistoricalInterestInstallments.map(idx => 
  generateInstallmentDate(formData.start_date, idx, frequency)
);
const updatedDates = [...historicalDates, todayStr].sort();

// DEPOIS (correto):
// Para contratos históricos com juros, o installment_dates contém APENAS a data de hoje
// As datas históricas são apenas para registro nos pagamentos, não no contrato
const updatedDates = [todayStr];
```

Isso resolve os dois problemas:
1. A única data no array é HOJE, então não está atrasado
2. Quando rolar a data, vai rolar de HOJE para o próximo mês

### Alteração 2: Ajustar lógica de status para contratos históricos existentes

**Arquivo:** `src/pages/Loans.tsx` - função `getLoanStatus()`

Para contratos já criados com o bug (que têm datas antigas no array), adicionar lógica especial:

```typescript
if (isHistoricalInterestContract) {
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // Para contratos históricos, a data válida é a ÚLTIMA do array (ou >= hoje)
  const validDate = dates.find(d => d >= todayStr) || dates[dates.length - 1];
  
  if (validDate) {
    const validDateObj = new Date(validDate + 'T12:00:00');
    validDateObj.setHours(0, 0, 0, 0);
    
    // Só está atrasado se today > validDate (não se today > data antiga)
    isOverdue = today > validDateObj;
    // ...
  }
}
```

### Alteração 3: Ajustar lógica de rollamento para contratos históricos

**Arquivo:** `src/pages/Loans.tsx` - seção de pagamento de juros

Quando o usuário paga juros de um contrato histórico:

```typescript
// Para contratos históricos, usar a data de HOJE como base para rolar
// NÃO usar as datas históricas
if (isHistoricalInterestContract) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDate = new Date(todayStr + 'T12:00:00');
  
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
  
  const nextDateStr = format(nextDate, 'yyyy-MM-dd');
  newInstallmentDates = [nextDateStr]; // Apenas a próxima data
}
```

### Alteração 4: Ajustar getCardStyle para garantir roxo

Mesmo que `isOverdue = false`, garantir que o card fique roxo:

```typescript
// 🆕 Contratos históricos com juros ficam ROXOS (não vermelhos)
// Verificar ANTES da lógica de isOverdue
if (isHistoricalInterestContract && !isPaid) {
  return 'bg-purple-500/20 border-purple-400 dark:bg-purple-500/30 dark:border-purple-400';
}
```

## Fluxo Corrigido

### Criação de contrato histórico:
1. Usuário define data início: 30/01/2025
2. Sistema detecta 12 meses passados
3. Usuário seleciona todas as parcelas de juros
4. Sistema registra 12 pagamentos de `[INTEREST_ONLY_PAYMENT]`
5. **NOVO:** `installment_dates = ["2026-01-30"]` (só hoje)
6. `due_date = "2026-01-30"`
7. Card aparece ROXO, vencimento = 30/01/2026, não está atrasado

### Pagamento de juros da parcela de hoje:
1. Usuário registra pagamento de juros
2. Sistema detecta `[HISTORICAL_INTEREST_CONTRACT]`
3. **NOVO:** Usa data de HOJE como base: `2026-01-30 + 1 mês = 2026-02-28`
4. `installment_dates = ["2026-02-28"]`
5. `due_date = "2026-02-28"`
6. Card continua ROXO, vencimento = 28/02/2026

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Loans.tsx` | handleSubmit - salvar só data de hoje |
| `src/pages/Loans.tsx` | handleDailySubmit - salvar só data de hoje |
| `src/pages/Loans.tsx` | getLoanStatus - lógica especial para históricos |
| `src/pages/Loans.tsx` | handleRenegotiateConfirm (pagamento juros) - usar data atual |
| `src/pages/Loans.tsx` | getCardStyle - garantir roxo para históricos |

## Resultado Esperado

Após as alterações:

| Antes | Depois |
|-------|--------|
| Badge "Atrasado" | Sem badge de atraso |
| Cor vermelha | Cor roxa |
| Venc: 30/01/2025 | Venc: 30/01/2026 |
| Próximo venc: 28/02/2025 | Próximo venc: 28/02/2026 |

## Complexidade

- **Estimativa**: Média
- **Linhas de código**: ~100-150
- **Risco**: Médio (alteração em lógica de datas)

## Testes Recomendados

1. Criar novo contrato histórico com 12 meses de juros → verificar que installment_dates tem só 1 data
2. Verificar que o card é ROXO e não vermelho
3. Verificar que "Venc:" mostra 30/01/2026 (hoje)
4. Registrar pagamento de juros → verificar que próximo vencimento é 28/02/2026
5. Verificar que o card continua ROXO
6. Testar com contrato semanal e quinzenal também
