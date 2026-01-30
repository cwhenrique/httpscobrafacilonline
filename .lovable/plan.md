

# Plano: Atualizar Total a Receber com Juros Históricos

## Problema Identificado

Quando o usuário cria um contrato histórico com juros antigos, o sistema:

1. Cria o empréstimo com `total_interest` calculado para **apenas 1 parcela futura**
2. Registra os pagamentos de juros históricos na tabela `loan_payments`
3. Atualiza as notas (`notes`) com as tags
4. **NÃO atualiza** o campo `total_interest` no banco para refletir TODOS os juros (históricos + futuros)

### Exemplo:
- Empréstimo de R$ 1.000 com 10% de juros mensais
- Data início: 15/01/2025 (13 meses atrás)
- Usuário seleciona 13 parcelas de juros históricos (R$ 100 cada = R$ 1.300 total)
- Próxima parcela: 15/02/2026 (1 parcela futura)

**Comportamento atual:**
- `total_interest` = R$ 100 (apenas 1 parcela futura)
- `total_paid` = R$ 1.300 (juros históricos registrados)
- "Total a Receber" exibe: R$ 1.000 + R$ 100 = R$ 1.100 ❌

**Comportamento esperado:**
- `total_interest` = R$ 1.400 (13 históricos + 1 futuro = 14 parcelas)
- `total_paid` = R$ 1.300
- "Total a Receber" exibe: R$ 1.000 + R$ 1.400 = R$ 2.400 ✓

## Causa Raiz

No `handleSubmit` (linhas 3675-3679) e `handleDailySubmit` (linhas 3065-3069), o update só atualiza:
- `notes`
- `due_date`
- `installment_dates`

Falta atualizar:
- `total_interest` (com o valor total de juros: históricos + futuros)

## Solução

### Lógica de Cálculo

O `total_interest` correto deve incluir:

1. Juros históricos pagos: `totalHistoricalInterest` (soma dos juros das parcelas selecionadas)
2. Juros futuros: juros da próxima parcela (mesma taxa por parcela)

**Fórmula:**
```typescript
// Número total de parcelas = históricas + 1 futura
const totalInstallments = selectedHistoricalInterestInstallments.length + 1;

// Calcular juros total baseado no interest_mode
let correctedTotalInterest: number;
if (formData.interest_mode === 'per_installment') {
  correctedTotalInterest = principal * (rate / 100) * totalInstallments;
} else if (formData.interest_mode === 'compound') {
  correctedTotalInterest = principal * Math.pow(1 + (rate / 100), totalInstallments) - principal;
} else {
  // on_total - juros único sobre o principal
  correctedTotalInterest = principal * (rate / 100);
}

// Também ajustar o remaining_balance
const correctedRemainingBalance = principal + correctedTotalInterest - totalHistoricalInterest;
```

### Alterações no Código

Atualizar o `supabase.from('loans').update(...)` para incluir:

```typescript
await supabase.from('loans').update({
  notes: currentNotes.trim(),
  due_date: nextDueDate,
  installment_dates: updatedDates,
  total_interest: correctedTotalInterest,
  remaining_balance: correctedRemainingBalance,
  installments: totalInstallments, // Total de parcelas incluindo históricas
}).eq('id', loanId);
```

## Arquivos Afetados

| Arquivo | Função | Localização | Alteração |
|---------|--------|-------------|-----------|
| src/pages/Loans.tsx | handleDailySubmit | ~linhas 3050-3070 | Calcular e atualizar total_interest e remaining_balance |
| src/pages/Loans.tsx | handleSubmit | ~linhas 3665-3680 | Calcular e atualizar total_interest e remaining_balance |

## Código Detalhado

### Para handleSubmit (empréstimos regulares - semanal/quinzenal/mensal):

```typescript
// ANTES da linha do update (após linha 3666)
// Calcular o total_interest CORRETO incluindo todas as parcelas (históricos + futura)
const totalInstallments = selectedHistoricalInterestInstallments.length + 1;

let correctedTotalInterest: number;
if (formData.interest_mode === 'per_installment') {
  correctedTotalInterest = principal * (rate / 100) * totalInstallments;
} else if (formData.interest_mode === 'compound') {
  correctedTotalInterest = principal * Math.pow(1 + (rate / 100), totalInstallments) - principal;
} else {
  // on_total
  correctedTotalInterest = principal * (rate / 100);
}

// remaining_balance = principal + juros totais - juros já pagos
const correctedRemainingBalance = principal + correctedTotalInterest - totalHistoricalInterest;

// ALTERAR o update para incluir total_interest e remaining_balance
await supabase.from('loans').update({
  notes: currentNotes.trim(),
  due_date: nextDueDate,
  installment_dates: updatedDates,
  total_interest: correctedTotalInterest,
  remaining_balance: correctedRemainingBalance,
  installments: totalInstallments,
}).eq('id', loanId);
```

### Para handleDailySubmit (empréstimos diários):

```typescript
// ANTES da linha do update (após linha 3052)
// Para diários: total_interest armazena o valor da parcela diária
// Mas precisamos garantir que o remaining_balance reflete o total correto
const totalInstallments = selectedHistoricalInterestInstallments.length + 1;
const dailyAmount = parseFloat(formData.daily_amount) || 0;
const correctedRemainingBalance = dailyAmount * totalInstallments - totalHistoricalInterest;

// ALTERAR o update
await supabase.from('loans').update({
  notes: currentNotes.trim(),
  due_date: nextDueDate,
  installment_dates: updatedDates,
  remaining_balance: correctedRemainingBalance,
  installments: totalInstallments,
}).eq('id', loanId);
```

## Resultado Esperado

| Campo | Antes | Depois |
|-------|-------|--------|
| total_interest | R$ 100 (1 parcela) | R$ 1.400 (14 parcelas) |
| remaining_balance | R$ 1.000 + R$ 100 = R$ 1.100 | R$ 1.000 + R$ 1.400 - R$ 1.300 = R$ 1.100 |
| "Total a Receber" UI | R$ 1.100 | R$ 2.400 |

**Nota:** O `remaining_balance` fica igual em valor numérico, mas agora o cálculo está correto!

O "Total a Receber" na UI é calculado como:
- `principal_amount + total_interest` (linha 7683)

Então, ao corrigir `total_interest`, o valor exibido será correto.

## Testes Recomendados

1. Criar empréstimo mensal com data 15/01/2025, selecionar todas 13 parcelas históricas
   - Verificar se "Total a Receber" = principal + (juros × 14 parcelas)

2. Criar empréstimo diário com data há 10 dias, selecionar todas as parcelas
   - Verificar se "Falta Receber" = (valor diário × total parcelas) - juros pagos

3. Verificar que o card mostra valores corretos após refetch

