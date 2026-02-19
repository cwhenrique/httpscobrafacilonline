

# Reajustar Lógica do Fluxo de Caixa

## Nova lógica

O fluxo de caixa passa a funcionar assim:

- **Capital Inicial** = soma do `principal_amount` de todos os emprestimos criados **dentro do periodo selecionado** (representa o dinheiro que o usuario tinha e colocou pra trabalhar)
- **Saidas** = mesma soma (o dinheiro saiu como emprestimos concedidos no periodo)
- **Entradas** = pagamentos recebidos no periodo
- **Saldo Atual** = Capital Inicial - Saidas + Entradas

Tudo respeita rigorosamente o filtro de periodo. Se um emprestimo foi criado no dia 18/02 e o filtro comeca no dia 19/02, ele nao aparece nem no capital inicial nem nas saidas.

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/ReportsLoans.tsx` | Alterar `calculatedInitialBalance` para usar emprestimos criados **dentro** do periodo (nao antes). Corrigir `balanceStats` que ainda soma juros duplicados. |
| `src/components/reports/CashFlowCard.tsx` | Atualizar texto do Capital Inicial para refletir que e baseado nos emprestimos do periodo. |

## Detalhes tecnicos

### 1. `ReportsLoans.tsx` - calculatedInitialBalance (linhas 752-764)

Antes: filtra emprestimos ativos criados **antes** do periodo.
Depois: filtra emprestimos criados **dentro** do periodo selecionado (usando `isWithinInterval`), incluindo tanto ativos quanto pagos, pois o capital inicial representa o total investido no periodo.

```tsx
const calculatedInitialBalance = useMemo(() => {
  if (!dateRange?.from || !dateRange?.to) {
    return stats.allLoans
      .reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
  }
  const start = startOfDay(dateRange.from);
  const end = endOfDay(dateRange.to);
  return stats.allLoans
    .filter(loan => {
      const loanDate = parseISO(loan.contract_date || loan.start_date);
      return isWithinInterval(loanDate, { start, end });
    })
    .reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
}, [stats.allLoans, dateRange]);
```

### 2. `ReportsLoans.tsx` - balanceStats (linhas 821-826)

Corrigir dupla contagem de juros que ainda existe neste calculo:

```tsx
const balanceStats = useMemo(() => {
  const totalInflows = filteredStats.totalReceived;
  const totalOutflows = filteredStats.totalLent + billsStats.paidTotal;
  const netResult = totalInflows - totalOutflows;
  return { totalInflows, totalOutflows, netResult };
}, [filteredStats, billsStats]);
```

### 3. `CashFlowCard.tsx` - texto do Capital Inicial (linha ~117)

Alterar o texto descritivo de "Baseado nos contratos ativos" para "Baseado nos emprestimos do periodo", e "Configurado manualmente" permanece quando o usuario definir manualmente.

