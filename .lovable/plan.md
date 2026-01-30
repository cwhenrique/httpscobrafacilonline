
# Plano: Corrigir Empréstimos com Pagamentos de Juros Indo para Filtro de Quitados

## Problema Identificado

Quando você paga vários juros em um empréstimo antigo, ele está aparecendo no filtro de "Quitados" quando deveria permanecer em "Aberto".

**Exemplo do banco de dados encontrado:**
- Principal: R$ 1.000
- Juros: R$ 300
- Total a Receber: R$ 1.300
- Total Pago: R$ 1.800 (6 pagamentos de juros de R$ 300)
- Saldo Restante: R$ 1.300 (correto no banco!)
- Status no banco: `pending` (correto!)

**Problema**: O frontend calcula `isPaid` como:
```typescript
const remainingToReceive = totalToReceive - (loan.total_paid || 0);
// = 1300 - 1800 = -500
const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
// = false || true = TRUE (ERRADO!)
```

O `total_paid` inclui TODOS os pagamentos, inclusive os de "somente juros" que **não reduzem o saldo devedor**. O banco já calcula corretamente o `remaining_balance` excluindo esses pagamentos, mas o frontend ignora esse valor.

## Solução

Alterar a função `getLoanStatus` no frontend para usar `remaining_balance` do banco como fonte de verdade, ao invés de recalcular localmente.

## Alteração Necessária

**Arquivo**: `src/pages/Loans.tsx`
**Função**: `getLoanStatus` (linhas ~2337-2498)

### Antes (código problemático):
```typescript
const remainingToReceive = totalToReceive - (loan.total_paid || 0);
// ... mais código ...
const isPaid = loan.status === 'paid' || remainingToReceive <= 0;
```

### Depois (código corrigido):
```typescript
// USAR remaining_balance do banco como fonte de verdade
// O banco já exclui pagamentos de somente juros do cálculo
const remainingToReceive = loan.remaining_balance ?? (totalToReceive - (loan.total_paid || 0));
// ... mais código ...
const isPaid = loan.status === 'paid' || remainingToReceive <= 0.01;
```

## Lógica Completa da Correção

A função `getLoanStatus` será atualizada para:

1. **Usar `remaining_balance` do banco** quando disponível (todos os empréstimos têm esse campo)
2. Fazer fallback para o cálculo manual apenas se `remaining_balance` não estiver definido (casos edge impossíveis)
3. Usar tolerância de 0.01 para evitar problemas de arredondamento

```typescript
const getLoanStatus = (loan: typeof loans[0]) => {
  // ... código existente de cálculo de totalToReceive ...
  
  // CORREÇÃO: Usar remaining_balance do banco como fonte de verdade
  // O banco já exclui corretamente os pagamentos de "somente juros" do saldo
  const remainingToReceive = loan.remaining_balance;
  
  // ... código existente ...
  
  // Usar o status do banco OU remaining_balance como fonte de verdade
  const isPaid = loan.status === 'paid' || remainingToReceive <= 0.01;
  
  // ... resto da função ...
};
```

## Por Que Isso Funciona

O trigger `recalculate_loan_total_paid` no banco de dados já faz a lógica correta:

```sql
-- Sum only balance-reducing payments (excluding interest-only, partial interest, etc.)
SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
FROM loan_payments
WHERE loan_id = ...
  AND notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%'
  AND notes NOT LIKE '%[PARTIAL_INTEREST_PAYMENT]%'
  -- outros filtros...
```

O `remaining_balance` no banco já é calculado como:
```sql
remaining_balance = total_to_receive - balance_reducing_payments
```

Portanto, já desconta corretamente os pagamentos que não reduzem o saldo.

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Empréstimo com 6 pagamentos de "só juros" | Vai para "Quitados" | Permanece em "Aberto" |
| Empréstimo quitado normalmente | Vai para "Quitados" | Vai para "Quitados" |
| Empréstimo com pagamentos mistos | Comportamento incorreto | Comportamento correto |

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Loans.tsx` | Alterar função `getLoanStatus` (~linha 2366-2371) |

## Estimativa

- **Complexidade**: Baixa
- **Linhas alteradas**: ~5
- **Risco**: Mínimo (apenas corrige o cálculo, usa dados que já existem no banco)
- **Testes recomendados**: 
  - Verificar empréstimo com vários pagamentos de juros → deve aparecer em "Aberto"
  - Verificar empréstimo quitado normalmente → deve aparecer em "Quitados"
  - Verificar filtros funcionando corretamente
