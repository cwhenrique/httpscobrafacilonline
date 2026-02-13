

# Correção: Empréstimos de Nathalia Cristina e Silvia Nogueira

## Problema

Dois empréstimos foram dados como "baixa total" pelo usuário, mas o pagamento registrado cobriu apenas o valor do **principal**, sem incluir os juros. Isso faz o gatilho calcular saldo restante > 0, mantendo os empréstimos como "em atraso".

| Cliente | Empréstimo | Principal | Juros | Pagamento | Saldo Incorreto |
|---|---|---|---|---|---|
| Nathalia Cristina | `ce3bbfd5` | R$ 500 | R$ 150 | R$ 500 | R$ 150 |
| SILVIA NOGUEIRA | `4779aeb2` | R$ 40.000 | R$ 8.000 | R$ 40.000 | R$ 8.000 |

## Solução

Corrigir diretamente no banco os dois empréstimos, zerando o `remaining_balance` e definindo `status = 'paid'`. Nenhuma alteracao de codigo frontend e necessaria -- trata-se apenas de dados incorretos.

### Detalhes Tecnicos

**Migracao SQL:**

```sql
UPDATE loans
SET remaining_balance = 0,
    status = 'paid',
    updated_at = NOW()
WHERE id IN (
  'ce3bbfd5-4881-4c2a-89f9-7ec9f9a6445d',
  '4779aeb2-383d-4c32-a66c-4c1d42fb6627'
)
AND status != 'paid';
```

**Arquivos a modificar:** Nenhum arquivo de codigo. Apenas uma migracao SQL de reparo de dados.
