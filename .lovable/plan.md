
# Correção: Lógica do Capital Inicial no Fluxo de Caixa

## Diagnóstico do problema

O usuário vê R$ 36.500 sugerido como Capital Inicial, mas seus empréstimos **ativos** não somam esse valor. Isso acontece porque o cálculo atual usa:

```typescript
// ReportsLoans.tsx linha 752-758
const calculatedInitialBalance = useMemo(() => {
  const totalPrincipalEverLoaned = stats.allLoans.reduce((sum, loan) => {
    return sum + Number(loan.principal_amount);  // ← inclui TODOS, ativos + quitados
  }, 0);
  return totalPrincipalEverLoaned;
}, [stats.allLoans]);
```

Ou seja: R$ 36.500 = soma do **principal histórico de todos os empréstimos**, incluindo os já quitados.

### Problemas identificados

1. **Sugestão confusa**: A "sugestão do sistema" é o somatório histórico de TUDO que foi emprestado algum dia — incluindo empréstimos quitados que já retornaram ao caixa. Isso não representa o capital disponível do usuário.

2. **Saldo atual incompleto**: O cálculo do `currentBalance` não inclui os juros recebidos:
   ```typescript
   const currentBalance = effectiveBalance - loanedInPeriod + receivedInPeriod;
   // Faltam: + interestReceived, - billsPaid, - extraCosts
   ```

3. **Falta contexto no modal**: O modal "Configurar Saldo Inicial" não explica claramente que o valor sugerido inclui empréstimos quitados.

---

## Solução proposta

### 1. Melhorar a sugestão do Capital Inicial

Mudar o cálculo para oferecer **duas opções** de referência, com explicação clara:

- **Opção A** (mais precisa): Soma apenas o `principal_amount` dos **empréstimos ativos** (não quitados) → representa o capital que está "na rua" agora
- **Opção B** (histórica, atual): Soma o `principal_amount` de todos os empréstimos já realizados → representa o capital total investido historicamente

O cálculo sugerido passará a usar a **Opção A** por padrão (empréstimos ativos), que é o que o usuário espera ver.

**Mudança em `ReportsLoans.tsx`:**
```typescript
const calculatedInitialBalance = useMemo(() => {
  // Capital na rua agora: apenas empréstimos ativos
  // Representa o capital que o usuário tem investido no momento
  const activeLoansTotal = stats.allLoans
    .filter(loan => loan.status !== 'paid')
    .reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
  return activeLoansTotal;
}, [stats.allLoans]);
```

### 2. Corrigir o cálculo do Saldo Atual

O `currentBalance` deve refletir corretamente todos os fluxos:

```typescript
const currentBalance = effectiveBalance 
  - loanedInPeriod          // saídas: empréstimos concedidos
  + receivedInPeriod        // entradas: pagamentos de principal
  + interestReceived;       // entradas: juros recebidos
  // (bills e extraCosts são descontados no CashFlowCard dinamicamente via toggle)
```

**Mudança em `ReportsLoans.tsx`:**
```typescript
const cashFlowStats = useMemo(() => {
  const loanedInPeriod = filteredStats.totalLent;
  const receivedInPeriod = filteredStats.totalReceived;
  const interestReceived = filteredStats.realizedProfit;

  const effectiveBalance = initialCashBalance > 0
    ? initialCashBalance
    : calculatedInitialBalance;

  // Saldo atual = capital inicial - saídas (empréstimos) + entradas (recebimentos + juros)
  const currentBalance = effectiveBalance - loanedInPeriod + receivedInPeriod + interestReceived;

  return {
    initialBalance: initialCashBalance,
    loanedInPeriod,
    receivedInPeriod,
    interestReceived,
    currentBalance,
  };
}, [initialCashBalance, calculatedInitialBalance, filteredStats]);
```

### 3. Melhorar o texto descritivo no modal

Atualizar o texto em `CashFlowConfigModal.tsx` e no `CashFlowCard.tsx` para deixar claro o que cada valor representa:

- **No modal**: Trocar "Baseado no total de capital emprestado historicamente" por "Baseado no capital atualmente em contratos ativos"
- **No card**: Adicionar subtexto ao lado do valor sugerido explicando a origem

**Mudança em `CashFlowCard.tsx`** (prop `calculatedInitialBalance` já existe, apenas mudar onde é exibida):
```tsx
// Texto atual no modal:
"Baseado no total de capital emprestado historicamente"

// Texto corrigido:
"Baseado no principal dos contratos ativos atuais"
```

---

## Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `src/pages/ReportsLoans.tsx` | Filtrar `stats.allLoans` por `status !== 'paid'` no `calculatedInitialBalance`; adicionar `interestReceived` ao `currentBalance` |
| `src/components/reports/CashFlowConfigModal.tsx` | Atualizar texto descritivo da sugestão |
| `src/components/reports/CashFlowCard.tsx` | Atualizar subtexto da sugestão de capital inicial |

---

## Impacto esperado

Antes: Sugestão = R$ 36.500 (histórico total, confuso)  
Depois: Sugestão = valor real dos empréstimos **ativos** (ex: R$ 20.000)

O saldo atual também passará a incluir os juros já recebidos no período, tornando o número mais fiel à realidade do caixa.
