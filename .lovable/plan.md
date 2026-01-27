
# Corrigir Problema de Fuso Horário no Filtro de Empréstimos

## Diagnóstico

O empréstimo de R$ 10.000 com `contract_date: "2026-01-27"` não está aparecendo nos relatórios de janeiro porque:

1. `new Date("2026-01-27")` interpreta a string como **meia-noite UTC**
2. No Brasil (UTC-3), isso equivale a **26 de janeiro às 21:00**
3. O filtro "01/01 - 27/01" não inclui o dia 26, então o empréstimo é excluído

## Solução

Substituir `new Date()` por `parseISO()` de date-fns em todos os locais que usam `contract_date` ou `start_date` para filtragem. O `parseISO` trata a string como data local, corrigindo o problema de fuso horário.

## Alterações Necessárias

### Arquivo: `src/pages/ReportsLoans.tsx`

| Local | Linha | Antes | Depois |
|-------|-------|-------|--------|
| filteredLoans | ~333 | `new Date(loan.contract_date \|\| loan.start_date)` | `parseISO(loan.contract_date \|\| loan.start_date)` |
| loansInPeriod | ~578 | `new Date(loan.contract_date \|\| loan.start_date)` | `parseISO(loan.contract_date \|\| loan.start_date)` |
| monthlyEvolution | ~634 | `new Date(loan.contract_date \|\| loan.start_date)` | `parseISO(loan.contract_date \|\| loan.start_date)` |

## Detalhes Tecnicos

### Por que `new Date()` falha?

```javascript
// String ISO sem hora = UTC meia-noite
new Date("2026-01-27") // = 2026-01-27T00:00:00.000Z (UTC)
                       // = 2026-01-26T21:00:00.000-03:00 (Brasil)

// parseISO trata como data local
parseISO("2026-01-27") // = 2026-01-27T00:00:00.000-03:00 (Brasil)
```

### Código corrigido:

**Linha ~333 (filteredLoans):**
```typescript
loans = loans.filter(loan => {
  const loanDate = parseISO(loan.contract_date || loan.start_date);
  return isWithinInterval(loanDate, { start: dateRange.from!, end: dateRange.to! });
});
```

**Linha ~578 (loansInPeriod):**
```typescript
const loansInPeriod = dateRange?.from && dateRange?.to
  ? loansFilteredByType.filter(loan => {
      const loanDate = parseISO(loan.contract_date || loan.start_date);
      return isWithinInterval(loanDate, { start: dateRange.from!, end: dateRange.to! });
    })
  : loansFilteredByType;
```

**Linha ~634 (monthlyEvolution):**
```typescript
baseLoans.forEach(loan => {
  const loanDate = parseISO(loan.contract_date || loan.start_date);
  if (isWithinInterval(loanDate, { start: monthStart, end: monthEnd })) {
    // ...
  }
});
```

## Resultado Esperado

Após a correção:

| Metrica | Antes | Depois |
|---------|-------|--------|
| Saidas (janeiro) | R$ 5.580 | R$ 15.580 |
| Entradas | R$ 2.000 | R$ 2.000 |
| Caixa Atual | Inicial + R$ 2.000 | Inicial - R$ 10.000 + R$ 2.000 |

O empréstimo de R$ 10.000 será corretamente contabilizado em janeiro, e o caixa atual refletirá a saída de R$ 10k e a entrada de R$ 2k.

## Arquivos Modificados

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/ReportsLoans.tsx` | Substituir `new Date()` por `parseISO()` em 3 locais |

## Nota

O `parseISO` já está importado no arquivo (linha 41), então não há necessidade de adicionar novas importações.
