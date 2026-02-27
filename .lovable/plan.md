

## Diagnóstico do Bug

O card "restante a receber" dos empréstimos diários está mostrando valores incorretos (ex: R$ 43 ao invés de R$ 583 para ROSEMEIRE). O problema afeta **15 empréstimos** deste usuário.

### Causa Raiz

A fórmula do `remainingToReceive` no card e na lista subtrai `extraCount * installmentValue` do `remaining_balance`, assumindo que existem tags `[DAILY_PENALTY]` correspondentes que seriam somadas de volta. Porém, nenhum desses empréstimos possui tags `[DAILY_PENALTY]` — apenas `[EXTRA_INSTALLMENTS]`.

```text
Fórmula atual (ERRADA):
remainingToReceive = remaining_balance + totalAppliedPenalties - penaltiesAlreadyInBalance
                   = 583            + 0                     - (20 * 27 = 540)
                   = 43  ← ERRADO

Correto: remaining_balance = 583 (já é o valor correto do banco)
```

As `EXTRA_INSTALLMENTS` já estão corretamente refletidas no `remaining_balance` pelo trigger do banco. O código subtrai esse valor achando que há duplicação com `DAILY_PENALTY`, mas como não há tags `DAILY_PENALTY`, o resultado é uma subtração indevida.

### Correção

**Arquivo: `src/pages/Loans.tsx`** — 3 locais com a mesma fórmula:

1. **Linha ~8822-8827** (card view não-diário)
2. **Linha ~11127-11129** (list view diário)
3. **Linha ~2759** (detalhes do empréstimo)

A correção é: quando `totalAppliedPenalties` (DAILY_PENALTY) é zero, não subtrair `penaltiesAlreadyInBalance`. A subtração só faz sentido quando há `DAILY_PENALTY` tags que seriam somadas ao remaining, criando duplicação com `EXTRA_INSTALLMENTS`.

Fórmula corrigida:
```typescript
// Só subtrair penaltiesAlreadyInBalance se há DAILY_PENALTY tags 
// (pois a subtração serve para compensar a duplicação entre os dois sistemas)
const netPenaltyAdjustment = totalAppliedPenalties > 0 
  ? totalAppliedPenalties - penaltiesAlreadyInBalance 
  : 0;
remainingToReceive = Math.max(0, loan.remaining_balance + netPenaltyAdjustment);
```

Isso garante que:
- Quando há apenas `EXTRA_INSTALLMENTS` (sem `DAILY_PENALTY`): `remainingToReceive = remaining_balance` (correto, banco já reflete tudo)
- Quando há ambos: a fórmula continua desduplicando corretamente

### Locais a corrigir

1. Card view (linhas ~8822-8827) — empréstimos não-diários/card principal
2. List view daily (linhas ~11127-11129)
3. Total a Receber no card (linhas ~8782-8787) — mesma lógica para o "Total a Receber"
4. Qualquer outro local que use a mesma fórmula `remaining_balance + penalties - penaltiesAlreadyInBalance`

