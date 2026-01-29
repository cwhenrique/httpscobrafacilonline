

# Plano: Remover Data 25/01 do Calendário (TAHINA)

## Contexto

O usuário identificou que a data 25/01 no empréstimo da TAHINA é um bug visual e deseja removê-la do calendário, mantendo o empréstimo como está.

## Estado Atual do Empréstimo

```
id: c850300d-6a85-467c-b093-e9f199d3ef2f
installment_dates: ["2026-01-22", "2026-01-25", "2026-02-06"]
installments: 3
due_date: 2026-01-25
status: overdue
```

## Solução

Executar UPDATE para remover a data 25/01 do array e ajustar campos relacionados:

```sql
UPDATE loans 
SET 
  installment_dates = '["2026-01-22", "2026-02-06"]'::jsonb,
  installments = 2,
  due_date = '2026-02-06',
  status = 'pending'
WHERE id = 'c850300d-6a85-467c-b093-e9f199d3ef2f';
```

## Alterações

| Campo | Antes | Depois |
|-------|-------|--------|
| installment_dates | ["2026-01-22", "2026-01-25", "2026-02-06"] | ["2026-01-22", "2026-02-06"] |
| installments | 3 | 2 |
| due_date | 2026-01-25 | 2026-02-06 |
| status | overdue | pending |

## Resultado Esperado

- A data 25/01 não aparecerá mais no Calendário de Cobranças
- O empréstimo continuará visível na página de Empréstimos
- A próxima parcela será 06/02 (status: pendente)

