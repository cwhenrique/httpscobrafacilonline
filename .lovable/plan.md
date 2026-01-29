

# Plano: Corrigir Empréstimo da TAHINA (ID Específico)

## Problema Encontrado

O UPDATE anterior **não foi aplicado** porque usamos o `client_id` como filtro, mas no banco:
- O empréstimo tem ID: `c850300d-6a85-467c-b093-e9f199d3ef2f`
- O cliente TAHINA tem ID: `052d702b-6c79-465e-94fa-5cebaf5afb6f`

**Estado atual do empréstimo:**
```
id: c850300d-6a85-467c-b093-e9f199d3ef2f
client_id: 052d702b-6c79-465e-94fa-5cebaf5afb6f
installment_dates: ["2026-01-22", "2026-02-06", "2026-01-25"]  ❌ Fora de ordem
status: pending  ❌ Deveria ser overdue
```

## Solução

Executar UPDATE diretamente pelo ID do empréstimo:

```sql
UPDATE loans 
SET 
  installment_dates = '["2026-01-22", "2026-01-25", "2026-02-06"]'::jsonb,
  status = 'overdue'
WHERE id = 'c850300d-6a85-467c-b093-e9f199d3ef2f';
```

## Resultado Esperado

Após a correção:
```
installment_dates: ["2026-01-22", "2026-01-25", "2026-02-06"]
                        ↑ PAGO        ↑ ATRASADO    ↑ ABERTO
status: overdue
```

- O empréstimo aparecerá na página de Empréstimos com status "Atrasado"
- O Calendário continuará mostrando corretamente
- Ambas as visualizações estarão sincronizadas

## Impacto

| Local | Antes | Depois |
|-------|-------|--------|
| Calendário | ✅ Mostra 25/01 atrasado | ✅ Mantém |
| Página Empréstimos | ❌ Não mostra atraso | ✅ Mostrará atraso |
| Status no banco | pending | overdue |

