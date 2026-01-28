
# Resetar Empréstimo Paula tia vera

## Estado Atual

| Campo | Valor Atual |
|-------|-------------|
| Cliente | Paula tia vera |
| Tipo | Quinzenal (biweekly) |
| Principal | R$ 350,00 |
| Juros | R$ 70,00 |
| **Total a Receber** | R$ 420,00 |
| total_paid | R$ 420,00 |
| remaining_balance | R$ 70,00 |
| status | pending |

### Pagamentos a Excluir (3 registros)

| Data | Valor | ID |
|------|-------|-----|
| 06/01/2026 | R$ 100,00 | 357a91d6-... |
| 13/01/2026 | R$ 250,00 | cee71d08-... |
| 20/01/2026 | R$ 70,00 | 201067be-... |

## Operacoes a Executar

### 1. Excluir Pagamentos
```sql
DELETE FROM loan_payments 
WHERE loan_id = 'b6fdba1c-541f-436b-9874-f7b89c09f7e3';
```

### 2. Resetar Emprestimo para Estado Original
```sql
UPDATE loans 
SET 
  total_paid = 0,
  remaining_balance = 420.00,
  status = 'pending',
  notes = NULL,
  updated_at = NOW()
WHERE id = 'b6fdba1c-541f-436b-9874-f7b89c09f7e3';
```

## Resultado Final

| Campo | Valor Apos Reset |
|-------|------------------|
| total_paid | R$ 0,00 |
| remaining_balance | R$ 420,00 |
| status | pending |
| notes | (limpo) |
| Pagamentos | 0 |

O emprestimo voltara ao estado inicial, pronto para receber novos pagamentos.
