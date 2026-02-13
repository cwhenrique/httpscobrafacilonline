

# Correção: Empréstimos Quitados Reabertos pela Migração

## Causa Raiz

A migração que adicionou a coluna `created_by` na tabela `loan_payments` executou:
```sql
UPDATE loan_payments SET created_by = user_id WHERE created_by IS NULL;
```

Esse UPDATE disparou o gatilho `recalculate_loan_total_paid` em **todas as linhas de pagamentos**, recalculando o saldo de **13.029 empréstimos** no sistema inteiro. Desses, **396 empréstimos** que estavam quitados voltaram a ficar "abertos" (pending/overdue).

## Por que o recálculo deu errado?

O gatilho calcula o saldo restante assim:

```
remaining_balance = total_a_receber - pagamentos_que_reduzem_saldo
```

Pagamentos marcados como `[INTEREST_ONLY_PAYMENT]` ou `[AMORTIZATION]` sao **excluidos** do calculo de "pagamentos que reduzem saldo". Isso faz sentido durante a vida do emprestimo, mas quando o cliente ja pagou **tudo** (principal + juros), o gatilho ainda mostra saldo restante porque ignora os pagamentos de juros.

**Exemplo concreto do usuario tarciziomartinez@gmail.com:**
- Emprestimo `d5ec15dc`: Principal R$ 5.000 + Juros R$ 1.250 = Total R$ 6.250
- Pagou R$ 5.000 (normal) + R$ 1.250 (interest-only) = R$ 6.250 total
- Gatilho calcula: remaining = 6.250 - 5.000 = R$ 1.250 (ignora o pagamento de juros)
- Status: "overdue" em vez de "paid"

## Plano de Correção

### 1. Corrigir o gatilho `recalculate_loan_total_paid`

Adicionar uma verificacao **antes** do calculo de remaining_balance: se `total_paid >= total_to_receive`, o emprestimo esta quitado independentemente do tipo de pagamento.

```sql
-- Nova verificacao apos calcular total_to_receive:
IF total_payments >= total_to_receive - 0.01 THEN
  -- Pago integralmente, nao importa como
  UPDATE loans SET remaining_balance = 0, status = 'paid', ...
  RETURN;
END IF;
```

### 2. Corrigir os 396 empréstimos afetados

Executar uma query de reparo para restaurar o status correto dos emprestimos que tiveram total_paid >= total_a_receber mas estao com status != 'paid'.

### 3. Detalhes tecnicos

**Migracao SQL:**
- Atualizar a funcao `recalculate_loan_total_paid` com a verificacao adicional
- UPDATE em loans afetados para restaurar status = 'paid' e remaining_balance = 0

**Condicoes do reparo:**
- Emprestimos normais (nao-daily): `total_paid >= principal_amount + total_interest`
- Emprestimos daily: `total_paid >= total_interest * installments`
- Excluir emprestimos com tag `[DISCOUNT_SETTLEMENT]` (ja tratados separadamente)

**Arquivos a modificar:**
- Nova migracao SQL apenas (sem alteracao de codigo frontend)

