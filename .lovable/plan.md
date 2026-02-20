

## Correção: Parcelas 9-17 marcadas como pagas sem pagamentos

### Problema Identificado
O empréstimo de **Samuel Rufino Da Silva** (ID: `dc5e778c`) tem os valores financeiros corretos após a exclusão do histórico:
- `total_paid: 0.00` (correto)
- `remaining_balance: 720.00` (correto)

Porém, o campo `notes` ainda contém **tags PARTIAL_PAID residuais** que não foram removidas pelo gatilho de exclusão:

```
[PARTIAL_PAID:8:47.00][PARTIAL_PAID:9:36.00][PARTIAL_PAID:10:36.00]
[PARTIAL_PAID:11:36.00][PARTIAL_PAID:12:36.00][PARTIAL_PAID:13:36.00]
[PARTIAL_PAID:14:36.00][PARTIAL_PAID:15:36.00][PARTIAL_PAID:16:36.00]
```

A interface lê essas tags para determinar quais parcelas estao pagas, entao mostra as parcelas 9 a 17 como pagas mesmo sem pagamentos no banco.

### Causa Raiz
O gatilho `revert_loan_on_payment_delete` tenta remover tags PARTIAL_PAID ao excluir pagamentos, mas so consegue remover as tags referenciadas nas notas de cada pagamento individual. Se os pagamentos foram excluidos em massa ou se as notas do pagamento nao continham a referencia correta da parcela, as tags ficam orfas.

### Correção

1. **Limpeza direta dos dados**: Remover todas as tags `[PARTIAL_PAID:...]` do campo `notes` deste emprestimo especifico, ja que nao ha pagamentos registrados.

2. O campo `notes` limpo ficara:
```
[SKIP_SATURDAY] [SKIP_SUNDAY] [SKIP_HOLIDAYS]
Valor emprestado: R$ 500.00
Parcela diária: R$ 36.00
Total a receber: R$ 720.00
Lucro: R$ 220.00
```

### Detalhes Tecnicos

Sera executado um UPDATE direto na tabela `loans` para remover as tags PARTIAL_PAID do campo `notes` do emprestimo `dc5e778c-e512-481b-9956-30b80c216747`. Nenhuma alteracao de codigo e necessaria - apenas correcao de dados.

