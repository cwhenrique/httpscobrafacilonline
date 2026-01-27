
# Correção: Juros Compostos em Empréstimos Semanais, Quinzenais e Tabela Price

## Diagnóstico

O cálculo de juros para empréstimos com `interest_mode: 'compound'` (incluindo Tabela Price, semanais e quinzenais com juros compostos) está **incorreto** em dois arquivos:

### Problema Identificado

O banco de dados armazena o valor correto de juros no campo `total_interest`, mas os hooks de estatísticas **recalculam** os juros ignorando esse valor:

| Arquivo | Problema |
|---------|----------|
| `useOperationalStats.ts` | Linhas 146-153 tratam `compound` igual a `on_total` |
| `ReportsLoans.tsx` | Linhas 238-242 tratam `compound` igual a `on_total` |

### Código Atual (Incorreto)

```typescript
// useOperationalStats.ts (linhas 150-153)
totalInterest = interestMode === 'per_installment' 
  ? principal * (rate / 100) * installments 
  : principal * (rate / 100);  // <-- Trata 'compound' como 'on_total'!

// ReportsLoans.tsx (linhas 240-242)  
: loan.interest_mode === 'per_installment'
  ? principal * (rate / 100) * numInstallments
  : principal * (rate / 100);  // <-- Mesmo problema!
```

### Exemplo Real do Banco de Dados

| Empréstimo | Principal | Taxa | Parcelas | total_interest (banco) | Cálculo atual (errado) |
|------------|-----------|------|----------|------------------------|------------------------|
| Tabela Price | R$ 2.000 | 12.5% | 10 | R$ 1.612,44 | R$ 250,00 |
| Semanal Composto | R$ 7.500 | 35% | 8 | R$ 75.243,04 | R$ 2.625,00 |

**Diferença de ~28x no segundo exemplo!**

## Solução

Usar o campo `total_interest` já armazenado no banco de dados quando disponível, e só recalcular como fallback. Para recálculo, tratar corretamente o modo `compound`.

## Alterações Técnicas

### 1. Arquivo: `src/hooks/useOperationalStats.ts`

**Modificar linhas 146-153:**

```typescript
// Antes (incorreto)
let totalInterest = 0;
if (isDaily) {
  totalInterest = remainingBalance + totalPaid - principal;
} else {
  totalInterest = interestMode === 'per_installment' 
    ? principal * (rate / 100) * installments 
    : principal * (rate / 100);
}

// Depois (correto)
let totalInterest = 0;
if (isDaily) {
  totalInterest = remainingBalance + totalPaid - principal;
} else if (loan.total_interest && Number(loan.total_interest) > 0) {
  // Usar o valor já calculado e armazenado no banco
  totalInterest = Number(loan.total_interest);
} else if (interestMode === 'per_installment') {
  totalInterest = principal * (rate / 100) * installments;
} else if (interestMode === 'compound') {
  // Juros compostos: M = P × (1 + i)^n - P
  totalInterest = principal * Math.pow(1 + (rate / 100), installments) - principal;
} else {
  // on_total
  totalInterest = principal * (rate / 100);
}
```

### 2. Arquivo: `src/pages/ReportsLoans.tsx`

**Modificar linhas 238-242:**

```typescript
// Antes (incorreto)
const totalInterestCalc = isDaily
  ? (Number(loan.remaining_balance) + Number(loan.total_paid || 0)) - Number(loan.principal_amount)
  : loan.interest_mode === 'per_installment'
    ? Number(loan.principal_amount) * (Number(loan.interest_rate) / 100) * numInstallments
    : Number(loan.principal_amount) * (Number(loan.interest_rate) / 100);

// Depois (correto)
let totalInterestCalc: number;
if (isDaily) {
  totalInterestCalc = (Number(loan.remaining_balance) + Number(loan.total_paid || 0)) - Number(loan.principal_amount);
} else if (loan.total_interest && Number(loan.total_interest) > 0) {
  // Usar o valor já calculado e armazenado no banco
  totalInterestCalc = Number(loan.total_interest);
} else if (loan.interest_mode === 'per_installment') {
  totalInterestCalc = Number(loan.principal_amount) * (Number(loan.interest_rate) / 100) * numInstallments;
} else if (loan.interest_mode === 'compound') {
  // Juros compostos: M = P × (1 + i)^n - P
  totalInterestCalc = Number(loan.principal_amount) * Math.pow(1 + (Number(loan.interest_rate) / 100), numInstallments) - Number(loan.principal_amount);
} else {
  // on_total
  totalInterestCalc = Number(loan.principal_amount) * (Number(loan.interest_rate) / 100);
}
```

## Arquivos Modificados

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `src/hooks/useOperationalStats.ts` | 146-153 | Priorizar `total_interest` do banco + tratar `compound` |
| `src/pages/ReportsLoans.tsx` | 238-242 | Priorizar `total_interest` do banco + tratar `compound` |

## Resultado Esperado

Após a correção:
- **Fluxo de Caixa**: Mostrará juros pendentes corretos para empréstimos compostos
- **Relatórios**: Mostrarão total de juros e lucro corretos
- **Tabela Price**: Valores já corretos no banco serão exibidos corretamente
- **Semanais/Quinzenais com juros compostos**: Valores corretos serão exibidos

## Benefícios da Abordagem

1. **Prioriza dados existentes**: Usa `total_interest` do banco quando disponível
2. **Fallback robusto**: Recalcula corretamente se o campo estiver vazio/zero
3. **Compatibilidade**: Funciona com empréstimos antigos e novos
4. **Consistência**: Garante que o Fluxo de Caixa mostre os mesmos valores dos cards de empréstimos
