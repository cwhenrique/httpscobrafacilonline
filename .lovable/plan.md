

# Plano: Corrigir Saldo Inicial Padrão para Capital na Rua Puro

## Entendimento da Lógica

O capital inicial padrão deve representar o **total de dinheiro que o usuário colocou na rua** - ou seja, o principal total dos empréstimos ativos.

**Lógica:**
- Se o usuário tem R$ 50.000 emprestado na rua, significa que ele **tinha pelo menos** R$ 50.000 de capital inicial
- O saldo inicial padrão deve ser exatamente esse valor: **o capital na rua puro**

## Fórmula Corrigida

**De:**
```typescript
calculatedInitialBalance = Total Recebido - Capital na Rua (INCORRETO)
```

**Para:**
```typescript
calculatedInitialBalance = Capital na Rua (principal dos empréstimos ativos)
```

## Alteração Necessária

### src/pages/ReportsLoans.tsx

**De:**
```typescript
const calculatedInitialBalance = useMemo(() => {
  const totalReceivedAllTime = stats.allLoans.reduce((sum, loan) => 
    sum + Number(loan.total_paid || 0), 0);
  
  const allActiveLoans = stats.allLoans.filter(loan => loan.status !== 'paid');
  const currentCapitalOnStreet = allActiveLoans.reduce((sum, loan) => {
    const principal = Number(loan.principal_amount);
    const payments = (loan as any).payments || [];
    const totalPrincipalPaid = payments.reduce((s: number, p: any) => 
      s + Number(p.principal_paid || 0), 0);
    return sum + Math.max(0, principal - totalPrincipalPaid);
  }, 0);
  
  return Math.max(0, totalReceivedAllTime - currentCapitalOnStreet);
}, [stats.allLoans]);
```

**Para:**
```typescript
const calculatedInitialBalance = useMemo(() => {
  // Capital inicial padrão = Capital na Rua Puro
  // Representa o total de principal emprestado que ainda está ativo
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

## Exemplo Prático

**Cenário:**
- Usuário tem 3 empréstimos ativos:
  - Empréstimo A: R$ 20.000 (R$ 5.000 já pago do principal)
  - Empréstimo B: R$ 15.000 (R$ 0 pago do principal)
  - Empréstimo C: R$ 10.000 (R$ 3.000 já pago do principal)

**Cálculo do Capital na Rua Puro:**
- A: R$ 20.000 - R$ 5.000 = R$ 15.000
- B: R$ 15.000 - R$ 0 = R$ 15.000
- C: R$ 10.000 - R$ 3.000 = R$ 7.000
- **Total: R$ 37.000** (Capital Inicial Padrão)

## Fluxo de Caixa Resultante

```text
┌─────────────────────────────────────────────────────────┐
│  Inicial: R$ 37.000 (capital na rua)                    │
│  → Saídas: R$ 3.500 (emprestado no período)             │
│  → Entradas: R$ 1.900 (recebido no período)             │
│  ─────────────────────────────────────────────────────  │
│  Saldo Atual: R$ 37.000 - R$ 3.500 + R$ 1.900           │
│             = R$ 35.400                                  │
└─────────────────────────────────────────────────────────┘
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ReportsLoans.tsx` | Simplificar `calculatedInitialBalance` para retornar apenas o capital na rua puro (principal pendente dos empréstimos ativos) |

