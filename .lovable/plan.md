

# Correção dos Pagamentos do Empréstimo de Mariany Faria

## Dados Identificados

Dois pagamentos precisam ser corrigidos na tabela `loan_payments`:

| ID do Pagamento | Parcela | interest_paid Atual | principal_paid Atual |
|-----------------|---------|---------------------|----------------------|
| `d4faafcb-5110-408e-af5f-d44d25380fb7` | 1 de 20 | -1320.00 | 1500.00 |
| `677c7023-cafc-4635-b09f-67c87d1aa122` | 2 de 20 | -1320.00 | 1500.00 |

## Valores Corretos

Baseado no empréstimo de R$ 3.000 com 20% de juros em 20 parcelas de R$ 180:
- **interest_paid correto**: 30.00 (R$ 600 de juros total / 20 parcelas)
- **principal_paid correto**: 150.00 (R$ 3.000 principal / 20 parcelas)

## Comandos SQL para Correção

```sql
-- Corrigir Parcela 1
UPDATE loan_payments 
SET interest_paid = 30.00, principal_paid = 150.00
WHERE id = 'd4faafcb-5110-408e-af5f-d44d25380fb7';

-- Corrigir Parcela 2
UPDATE loan_payments 
SET interest_paid = 30.00, principal_paid = 150.00
WHERE id = '677c7023-cafc-4635-b09f-67c87d1aa122';
```

## Impacto Esperado

- **Antes**: Lucro Realizado = R$ 7.841,82
- **Correção**: Remove -2.640,00 (2 x -1320) e adiciona +60,00 (2 x 30)
- **Depois**: Lucro Realizado = R$ 7.841,82 + 2.640,00 + 60,00 = **R$ 10.541,82**

## Ação

Executar os comandos UPDATE acima para corrigir os valores de `interest_paid` e `principal_paid` nos dois pagamentos.

