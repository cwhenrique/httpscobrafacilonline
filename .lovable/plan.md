

# Correcao: Multas NAO devem reduzir o saldo restante (remaining_balance)

## Problema

No emprestimo de "wellington fidelis da cruz junior" (usuario Mateussilva101210@gmail.com):
- 4 parcelas de R$ 162, total_to_receive = R$ 648
- 2 parcelas pagas com multa de R$ 8 cada = R$ 170 x 2 = R$ 340 total_paid
- remaining_balance atual: R$ 308 (ERRADO)
- remaining_balance correto: R$ 324 (2 parcelas de R$ 162)

A causa raiz esta no trigger `recalculate_loan_total_paid`. Ele calcula:

```text
remaining_balance = total_to_receive - balance_reducing_payments
                  = 648 - 340
                  = 308  (ERRADO)
```

O valor R$ 340 inclui R$ 16 de multas. Multas sao receita EXTRA que nao existem no `total_to_receive` original, entao nao deveriam ser subtraidas dele.

## Solucao

### 1. Arquivo: `src/pages/Loans.tsx` (insercao de pagamento)

Quando um pagamento inclui multa (`loanPenalties[index] > 0`), adicionar uma tag `[PENALTY_INCLUDED:valor]` nas notas do pagamento. Isso permite que o trigger identifique qual parte do pagamento e multa.

Na area onde `installmentNote` e construido e o pagamento e montado (~linha 4830-4841), somar as multas das parcelas pagas e adicionar a tag.

### 2. Trigger `recalculate_loan_total_paid` (SQL migration)

Modificar o calculo de `balance_reducing_payments` para descontar o valor de multas:

```text
balance_reducing_payments = SUM(amount) - SUM(penalty_from_notes)
```

Extrair `[PENALTY_INCLUDED:X.XX]` das notas de cada pagamento e subtrair do total de pagamentos redutores de saldo.

Logica SQL:
```sql
SELECT COALESCE(SUM(
  amount - COALESCE(
    (regexp_match(notes, '\[PENALTY_INCLUDED:([0-9.]+)\]'))[1]::numeric,
    0
  )
), 0) INTO balance_reducing_payments
FROM public.loan_payments
WHERE loan_id = ...
  AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
  AND (notes NOT LIKE '%[PARTIAL_INTEREST_PAYMENT]%' OR notes IS NULL)
  AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL)
  AND (notes NOT LIKE '%[AMORTIZATION]%' OR notes IS NULL);
```

### 3. Correcao dos dados existentes

Alem das alteracoes de codigo, sera necessario corrigir o emprestimo especifico que ja esta com o saldo errado. Isso pode ser feito via:
- Atualizar as notas dos 2 pagamentos existentes para incluir `[PENALTY_INCLUDED:8.00]`
- Executar um recalculo do remaining_balance

### 4. Arquivo: `src/pages/Loans.tsx` (PARTIAL_PAID tags)

Atualmente `PARTIAL_PAID` armazena o valor COM multa (170). Isso faz o `getPaidInstallmentsCount` considerar a parcela como paga corretamente, pois compara com `getInstallmentValue` que tambem inclui multa. Esse comportamento esta correto e nao precisa mudar.

### 5. Trigger `update_loan_on_payment` e `revert_loan_on_payment_delete`

O trigger `update_loan_on_payment` tambem precisa ser atualizado para nao subtrair a parte da multa do remaining_balance. Linha relevante:

```sql
remaining_balance = GREATEST(0, remaining_balance - NEW.amount)
```

Deve ser:

```sql
remaining_balance = GREATEST(0, remaining_balance - (NEW.amount - penalty_amount))
```

Onde `penalty_amount` e extraido da tag `[PENALTY_INCLUDED:X]` nas notas do pagamento.

O mesmo ajuste se aplica ao `revert_loan_on_payment_delete` para reverter corretamente.

## Resumo das alteracoes

| Arquivo/Recurso | Alteracao |
|---|---|
| `src/pages/Loans.tsx` | Adicionar tag `[PENALTY_INCLUDED:X]` ao registrar pagamento com multa |
| Migration SQL | Atualizar 3 triggers: `recalculate_loan_total_paid`, `update_loan_on_payment`, `revert_loan_on_payment_delete` |
| Migration SQL | Corrigir dados existentes do emprestimo afetado |

