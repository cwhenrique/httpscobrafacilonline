

# Corrigir Filtro de Data: Usar contract_date ao invés de start_date

## Resumo

O empréstimo de R$ 10.000 (para receber R$ 12.000) foi criado com:
- **contract_date**: 27/01/2026 (hoje - quando o dinheiro saiu)
- **start_date**: 27/02/2026 (quando as parcelas começam a vencer)

O filtro atual usa `start_date`, o que faz empréstimos com parcelas futuras não aparecerem no período correto para fins de **fluxo de caixa**.

## Solução

Alterar a lógica de filtro para usar `contract_date` (com fallback para `start_date` se não existir) para calcular empréstimos no período. Isso reflete corretamente quando o dinheiro saiu do caixa.

## Alterações Necessárias

### Arquivo: `src/pages/ReportsLoans.tsx`

**1. Ajustar filteredLoans (linha ~332-335)**

Usar `contract_date` ou `start_date` como fallback:

```typescript
// Filter by date range
if (dateRange?.from && dateRange?.to) {
  loans = loans.filter(loan => {
    // Usar contract_date (quando o dinheiro saiu) ou start_date como fallback
    const loanDate = new Date(loan.contract_date || loan.start_date);
    return isWithinInterval(loanDate, { start: dateRange.from!, end: dateRange.to! });
  });
}
```

**2. Ajustar loansInPeriod no filteredStats (linha ~576-581)**

Mesma lógica:

```typescript
const loansInPeriod = dateRange?.from && dateRange?.to
  ? loansFilteredByType.filter(loan => {
      // Usar contract_date (quando o dinheiro saiu) ou start_date como fallback
      const loanDate = new Date(loan.contract_date || loan.start_date);
      return isWithinInterval(loanDate, { start: dateRange.from!, end: dateRange.to! });
    })
  : loansFilteredByType;
```

**3. Ajustar monthlyEvolution (linha ~633-634)**

Para o gráfico de evolução mensal:

```typescript
baseLoans.forEach(loan => {
  // Usar contract_date para fluxo de caixa
  const loanDate = new Date(loan.contract_date || loan.start_date);
  if (isWithinInterval(loanDate, { start: monthStart, end: monthEnd })) {
    // ...
  }
});
```

## Resultado Esperado

Após essa mudança:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Saídas (janeiro) | R$ 5.580 | R$ 15.580 (inclui os R$ 10k) |
| Capital na Rua | R$ 13.331 | R$ 13.331 (sem mudança) |

O empréstimo de R$ 10.000 passará a ser contabilizado em janeiro porque foi quando o contrato foi feito e o dinheiro saiu do caixa.

## Lógica

- **contract_date**: Quando o dinheiro foi emprestado (saída de caixa)
- **start_date**: Quando as parcelas começam a vencer

Para relatórios de **fluxo de caixa**, o correto é usar `contract_date`, pois representa quando o dinheiro realmente saiu.

## Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/ReportsLoans.tsx` | Ajustar 3 locais para usar `contract_date || start_date` |

