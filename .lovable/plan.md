

## Correção do empréstimo Cristiano Amaral — Saldo incorreto

### Diagnóstico

Duas questões encontradas:

**1. Tag PARTIAL_PAID:18 com valor errado**
A tag `[PARTIAL_PAID:18:42.00]` registra R$42 (valor total da parcela), mas apenas R$32 foram pagos. Deveria ser `[PARTIAL_PAID:18:32.00]`. Isso faz o sistema considerar a parcela 19 (índice 18) como totalmente paga, quando R$10 ainda estão em aberto como sub-parcela.

**2. remaining_balance inflado no banco**
O trigger `recalculate_loan_total_paid` calcula `total_to_receive = total_interest × installments = 42 × 32 = 1344`. Com R$788 pagos, `remaining = 1344 - 788 = 556`. Depois o display soma as multas: `556 + 210 = 766`.

Porém, o correto segundo o usuário seria: 5 parcelas de R$42 (210) + sub-parcela R$10 + multa R$210 = **R$430**.

A diferença de 556 vs 220 (sem multas) sugere que o remaining_balance no banco está muito alto — o trigger está usando 32 parcelas no cálculo, mas muitas dessas já estão pagas via PARTIAL_PAID.

### Correções

#### 1. Corrigir dados do empréstimo de Cristiano (SQL direto)
- Trocar `[PARTIAL_PAID:18:42.00]` por `[PARTIAL_PAID:18:32.00]` nas notes
- Recalcular e corrigir `remaining_balance` para o valor correto baseado nas parcelas realmente em aberto

#### 2. `src/pages/Loans.tsx` — Corrigir lógica de isPaid para considerar sub-parcelas
Na linha 6658, a verificação `isPaid = paidAmount >= installmentValue * 0.99` não verifica se existe uma `ADVANCE_SUBPARCELA` pendente para aquele índice. Corrigir para:
```typescript
const hasSubparcela = (loan.notes || '').includes(`[ADVANCE_SUBPARCELA:${i}:`);
const isPaid = paidAmount >= installmentValue * 0.99 && !hasSubparcela;
```

#### 3. `src/pages/Loans.tsx` — Corrigir registro de PARTIAL_PAID no pagamento de adiantamentos
Na lógica de adiantamento (em torno da linha 4965), quando cria sub-parcela, registrar o valor **realmente pago** na tag PARTIAL_PAID em vez do valor total da parcela.

#### 4. Verificar cálculo de remaining_balance no trigger para daily loans com EXTRA_INSTALLMENTS
O trigger usa `total_interest * installments` para daily, o que inclui parcelas extras. Precisamos garantir que o remaining reflita apenas parcelas não pagas.

### Detalhes técnicos

- O `PARTIAL_PAID:18:42.00` causa um erro de R$10 (42-32) que se propaga como R$32 de diferença no display (parcela inteira contada como paga vs apenas R$32 pagos)
- O display soma penalties ao remaining_balance (linha 8738), o que é correto, mas o remaining_balance base precisa ser consistente
- A correção do trigger é delicada — daily loans usam `total_interest * installments` como total_to_receive, mas isso inclui EXTRA_INSTALLMENTS que podem ser apenas penalidades

