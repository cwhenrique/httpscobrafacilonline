

# Plano: Corrigir Saldo Inicial para Total de Principal Emprestado

## Problema Identificado

O cálculo atual do saldo inicial usa apenas o "Capital na Rua" (principal pendente dos empréstimos ativos):

```typescript
// LÓGICA ATUAL (INCORRETA)
const allActiveLoans = stats.allLoans.filter(loan => loan.status !== 'paid');
return currentCapitalOnStreet; // R$ 2.600
```

**Mas o correto é:** O saldo inicial deve representar **todo o dinheiro que o usuário emprestou** (soma do principal de TODOS os empréstimos, ativos e quitados).

## Seu Cenário

| Empréstimo | Principal | Status | Capital na Rua |
|------------|-----------|--------|----------------|
| Devedor 02 | R$ 1.000 | Ativo | R$ 600 (após pagamentos) |
| Devedor 02 (diária) | R$ 2.000 | Ativo | R$ 2.000 |
| Devedor 01 | R$ 500 | Quitado | R$ 0 |
| **TOTAL** | **R$ 3.500** | - | **R$ 2.600** |

- **Capital na Rua:** R$ 2.600 (correto para esse indicador)
- **Saldo Inicial do Fluxo de Caixa:** Deveria ser R$ 3.500 (todo principal emprestado)

## Fórmula Corrigida

```text
Saldo Inicial = Σ principal_amount de TODOS os empréstimos (ativos + quitados)
```

## Alteração Necessária

### src/pages/ReportsLoans.tsx (linhas 693-706)

**De:**
```typescript
const calculatedInitialBalance = useMemo(() => {
  // ERRADO: só pega empréstimos ativos e capital pendente
  const allActiveLoans = stats.allLoans.filter(loan => loan.status !== 'paid');
  const currentCapitalOnStreet = allActiveLoans.reduce((sum, loan) => {
    const principal = Number(loan.principal_amount);
    const payments = (loan as any).payments || [];
    const totalPrincipalPaid = payments.reduce((s: number, p: any) => 
      s + Number(p.principal_paid || 0), 0);
    return sum + Math.max(0, principal - totalPrincipalPaid);
  }, 0);
  
  return currentCapitalOnStreet;
}, [stats.allLoans]);
```

**Para:**
```typescript
const calculatedInitialBalance = useMemo(() => {
  // CORRETO: soma o principal de TODOS os empréstimos (ativos + quitados)
  // Representa o capital total que o usuário tinha para emprestar
  const totalPrincipalEverLoaned = stats.allLoans.reduce((sum, loan) => {
    return sum + Number(loan.principal_amount);
  }, 0);
  
  return totalPrincipalEverLoaned;
}, [stats.allLoans]);
```

## Fluxo de Caixa Resultante

```text
┌─────────────────────────────────────────────────────────┐
│  Inicial: R$ 3.500 (total emprestado historicamente)    │
│  → Saídas: R$ 0 (emprestado no período selecionado)     │
│  → Entradas: R$ 900 (recebido no período)               │
│  ─────────────────────────────────────────────────────  │
│  Saldo Atual: R$ 3.500 - R$ 0 + R$ 900 = R$ 4.400       │
└─────────────────────────────────────────────────────────┘
```

**Nota:** O saldo atual mostra que o dinheiro recebido voltou para o caixa, aumentando o capital disponível.

## Atualização do Texto no Modal

### src/components/reports/CashFlowConfigModal.tsx

Atualizar a descrição da sugestão:

**De:**
```text
"Baseado no capital na rua (principal dos empréstimos ativos)"
```

**Para:**
```text
"Baseado no total de capital emprestado historicamente"
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ReportsLoans.tsx` | Mudar `calculatedInitialBalance` para somar o principal de TODOS os empréstimos |
| `src/components/reports/CashFlowConfigModal.tsx` | Atualizar descrição da sugestão automática |

