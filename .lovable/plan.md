

## Diagnóstico: Multa abatida indevidamente do saldo

### O que encontrei

O pagamento `13d853d9` (Parcela 25) tem a tag `[PENALTY_INCLUDED:104.00]` com valor de R$ 96,00. Isso significa que o sistema registrou R$ 104 de multa dentro de um pagamento de apenas R$ 96 — valor inconsistente.

Além disso, existe a tag `[DAILY_PENALTY:24:104.00]` nas notas do empréstimo, confirmando uma multa de R$ 104 na parcela 24.

### Como o sistema encerrou o empréstimo indevidamente

O gatilho `recalculate_loan_total_paid` tem **duas condições** para marcar como `paid`:

1. **Condição 1** (correta): `total_to_receive - balance_reducing_payments <= 0.01` → 3016 - 2912 = **104** → NÃO marcaria como pago ✓
2. **Condição 2** (falha): `total_payments >= total_to_receive AND principal_paid >= principal` → 3016 >= 3016 **E** principal_paid >= 1500 → **MARCOU COMO PAGO** ✗

A condição 2 não desconta o valor da multa do `total_payments`, então os R$ 104 de penalidade foram contados como pagamento real, fazendo o total bater em R$ 3.016 e encerrando o contrato.

### Plano de correção

#### 1. Corrigir os dados do empréstimo via SQL
- `remaining_balance` = 104 (parcela 28 ou 29 em aberto)
- `total_paid` = 2912 (3016 - 104 de multa que não deveria contar)
- `status` = 'pending' ou 'overdue'
- Limpar tag `[DAILY_PENALTY:24:104.00]` das notas (já foi cobrada)

#### 2. Corrigir o gatilho `recalculate_loan_total_paid`
Na condição 2, descontar penalidades do `total_payments` antes de comparar com `total_to_receive`:
```sql
ELSIF (total_payments - total_penalty_amount) >= total_to_receive - 0.01 
  AND total_principal_payments >= loan_principal - 0.01 THEN
```

Isso impede que multas inflacionem o total de pagamentos e encerrem contratos prematuramente.

### Detalhes técnicos

- Pagamento problemático: `13d853d9` — R$ 96 com `[PENALTY_INCLUDED:104.00]`
- A multa era referente à parcela 24 (`[DAILY_PENALTY:24:104.00]`)
- Soma real de pagamentos: R$ 3.016, mas R$ 104 é penalidade, logo pagamento efetivo = R$ 2.912
- Parcelas 28 e 29 (índices 27/28) continuam em aberto

