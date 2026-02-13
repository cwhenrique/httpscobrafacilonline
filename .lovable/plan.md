

# Plano: Reverter 267 Emprestimos e Corrigir Gatilho

## Resumo do Problema

O gatilho `recalculate_loan_total_paid` possui uma verificacao prematura (early exit) que marca emprestimos como quitados quando `total_paid >= principal + juros`, sem excluir pagamentos de somente-juros. Em contratos recorrentes onde os juros sao pagos repetidamente, o acumulo desses pagamentos eventualmente ultrapassa o limiar e o gatilho quita o emprestimo indevidamente.

**Numeros reais apos investigacao completa:**

| Categoria | Quantidade | Acao |
|---|---|---|
| Total de emprestimos afetados | 267 | - |
| Com DISCOUNT_SETTLEMENT (legitimos) | 37 | Manter quitados |
| Emprestimos a reverter | 230 | Recalcular saldo |
| Usuarios afetados | ~90 | - |

## Causa Raiz no Gatilho

Na funcao `recalculate_loan_total_paid`, linhas 20-30 aproximadamente:

```text
-- BUG: Esta verificacao inclui pagamentos de somente-juros
IF total_payments >= total_to_receive - 0.01 THEN
    UPDATE loans SET remaining_balance = 0, status = 'paid' ...
    RETURN;   <-- Sai antes de calcular balance_reducing_payments
END IF;
```

A logica correta ja existe mais abaixo no gatilho (calcula `balance_reducing_payments` excluindo interest-only), mas nunca e alcancada porque o early exit dispara primeiro.

## Plano de Execucao

### Passo 1: Corrigir o Gatilho (Migracao SQL)

Modificar `recalculate_loan_total_paid` para que a verificacao de quitacao total tambem exclua pagamentos `[INTEREST_ONLY_PAYMENT]` e `[PARTIAL_INTEREST_PAYMENT]`:

```text
-- ANTES (bugado):
IF total_payments >= total_to_receive - 0.01 THEN ...

-- DEPOIS (corrigido):
-- Usar balance_reducing_payments no lugar de total_payments
-- para a verificacao de quitacao rapida
```

A funcao completa sera reescrita com a correcao, mantendo toda a logica existente para DISCOUNT_SETTLEMENT, amortizacoes e emprestimos diarios.

### Passo 2: Reverter os 230 Emprestimos (SQL de Dados)

Executar um UPDATE que recalcula `remaining_balance` e `status` para todos os emprestimos incorretamente quitados, excluindo os 37 com DISCOUNT_SETTLEMENT:

```text
Para cada emprestimo:
1. Calcular total_to_receive = principal + interest (ou interest * installments para diarios)
2. Calcular balance_reducing = soma dos pagamentos SEM tags interest-only/partial/amortization
3. remaining_balance = MAX(0, total_to_receive - balance_reducing)
4. status = CASE:
   - Se remaining_balance <= 0.01: 'paid'
   - Se due_date >= hoje: 'pending'
   - Senao: 'overdue'
5. total_paid = soma de TODOS os pagamentos (incluindo interest-only)
```

### Passo 3: Verificacao

Consultar os emprestimos atualizados para confirmar que:
- Nenhum emprestimo com DISCOUNT_SETTLEMENT foi alterado
- Os saldos recalculados correspondem aos valores esperados
- Os status refletem corretamente a situacao de cada contrato

## Detalhes Tecnicos

### Gatilho Corrigido

A funcao `recalculate_loan_total_paid` sera substituida com a seguinte mudanca principal:

O bloco de verificacao rapida (early exit) passara a calcular `balance_reducing_payments` **antes** de decidir se o emprestimo esta quitado, em vez de usar `total_payments` que inclui pagamentos de somente-juros. A verificacao de DISCOUNT_SETTLEMENT permanece inalterada como primeiro early exit.

### SQL de Reversao

O UPDATE usara subqueries para recalcular cada campo individualmente:
- `remaining_balance`: baseado apenas em pagamentos que reduzem saldo
- `total_paid`: soma de todos os pagamentos (para manter o historico de lucro)
- `status`: baseado no `remaining_balance` recalculado e na `due_date`

Filtros de seguranca:
- Apenas emprestimos com `status = 'paid'` e `remaining_balance = 0`
- Que possuam pagamentos `[INTEREST_ONLY_PAYMENT]`
- Que NAO possuam tag `[DISCOUNT_SETTLEMENT]` nas notas
- Onde pagamentos normais nao cobrem `principal + juros`

### Arquivos a Modificar

Nenhum arquivo de codigo frontend. Apenas:
1. Uma migracao SQL para o gatilho `recalculate_loan_total_paid`
2. Um comando SQL de dados para reverter os 230 emprestimos

