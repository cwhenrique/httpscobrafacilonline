

# Correcao: Emprestimos com Principal Pago mas Marcados como Abertos

## Problema

A correcao anterior do gatilho `recalculate_loan_total_paid` resolveu o problema de contratos recorrentes de juros sendo quitados indevidamente, mas criou um efeito colateral: emprestimos onde o **principal foi pago via pagamento regular** e os **juros foram pagos via pagamento de somente-juros** ficaram com saldo em aberto, porque o gatilho exclui pagamentos de somente-juros do calculo de quitacao.

**Exemplo (Edno Perreira Palheta):**
- Principal: R$ 5.000 | Juros: R$ 1.250 | Total: R$ 6.250
- Pagamento 1: R$ 1.250 (juros, tag INTEREST_ONLY) 
- Pagamento 2: R$ 5.000 (regular, principal_paid=3.750)
- Total pago: R$ 6.250 = valor total do contrato
- Gatilho ve: balance_reducing = R$ 5.000 (exclui o 1o pagamento), remaining = R$ 1.250

**Emprestimos afetados: 38 no total, sendo 22 onde total_paid ja cobre o valor integral.**

## Causa Raiz

O gatilho corrigido usa apenas `balance_reducing_payments` (excluindo INTEREST_ONLY) para verificar quitacao. Isso e correto para contratos recorrentes (onde principal_paid = 0), mas incorreto para contratos onde o principal JA FOI PAGO e os juros foram pagos separadamente.

## Solucao

Adicionar uma verificacao complementar no gatilho: se `total_payments >= total_to_receive` E `principal_paid_total >= principal_amount`, o emprestimo esta quitado. Isso diferencia:

1. **Contrato recorrente de juros** (NAO quitado): total_paid >= total mas principal_paid = 0
2. **Contrato com juros pre-pagos + principal pago** (QUITADO): total_paid >= total E principal_paid >= principal

## Plano de Execucao

### Passo 1: Atualizar o Gatilho

Adicionar apos a verificacao de `balance_reducing_payments`, uma segunda condicao:

```text
-- Verificacao adicional: se total pago cobre o contrato E principal foi quitado
SELECT COALESCE(SUM(principal_paid), 0) INTO total_principal_payments
FROM loan_payments
WHERE loan_id = ... AND notes NOT LIKE '%[PRE_RENEGOTIATION]%';

IF total_payments >= total_to_receive - 0.01 
   AND total_principal_payments >= loan_principal - 0.01 THEN
    new_status := 'paid';
    -- remaining_balance = 0
END IF;
```

### Passo 2: Corrigir os 38 Emprestimos

Executar UPDATE nos emprestimos onde:
- `status != 'paid'` e `remaining_balance > 0`
- `total_paid >= principal + interest`
- `SUM(principal_paid) >= principal_amount`
- Nao possuem tag `[DISCOUNT_SETTLEMENT]`

Para estes, definir `remaining_balance = 0` e `status = 'paid'`.

### Passo 3: Verificacao

Confirmar que:
- Os 38 emprestimos foram marcados como quitados
- Contratos recorrentes de juros (principal_paid = 0) permanecem abertos
- O gatilho funciona corretamente para novos pagamentos

### Detalhes Tecnicos

**Migracao SQL:** Uma unica migracao que:
1. Substitui a funcao `recalculate_loan_total_paid` com a nova variavel `total_principal_payments` e a condicao adicional
2. Atualiza os 38 emprestimos afetados

**Arquivos de codigo:** Nenhum arquivo frontend precisa ser alterado.

