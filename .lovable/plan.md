

## Diagnóstico

Para ROSEMEIRE: 37 parcelas de R$27 = R$999 total. 10 parcelas pagas (tags PARTIAL_PAID). Porém, nas parcelas 1 e 4, o cliente pagou R$100 cada (R$27 parcela + R$73 multa). O `remaining_balance` do banco é 583 (999 - 416 = 583), mas conta os R$146 de multa como redução do saldo.

O correto: 27 parcelas abertas × R$27 = **R$729** restante a receber. Multas pagas são lucro extra, não reduzem o que falta cobrar.

## Correção

**Arquivo: `src/pages/Loans.tsx`** — Para empréstimos diários, calcular `remainingToReceive` com base nas parcelas abertas em vez do `remaining_balance` do banco.

### Fórmula corrigida para daily loans:
```typescript
// Para daily: contar parcelas não pagas × valor da parcela
const paidCount = getPaidInstallmentsCount(loan);
const unpaidCount = Math.max(0, numInstallments - paidCount);
remainingToReceive = unpaidCount * dailyInstallmentAmount;
```

### Locais a corrigir (4 pontos):

1. **Card view principal** (~linha 8825-8834) — `remainingToReceive` do card individual
2. **List view diário** (~linhas 11130-11140) — `remainingToReceive` na lista
3. **`buildClientGroup`** (~linha 3103) — `remainingBalance` da pasta de cliente (usado no `ClientLoansFolder`)
4. **`ClientLoansFolder.tsx`** — os mini-resumos de cada empréstimo no componente da pasta (campo `loan.remaining` na lista interna) também devem usar a mesma lógica

### Regra geral:
- Para **daily loans**: `remainingToReceive = (installments - paidCount) × installmentValue`
- Para **não-daily**: manter lógica atual com `remaining_balance` do banco

Isso garante que multas e juros por atraso nunca diminuam o "restante a receber", pois são tratados como receita extra.

