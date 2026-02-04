

# Plano: Corrigir Datas Duplicadas do Empréstimo Maria de Jesus

## Problema Identificado

O empréstimo da cliente **Maria de Jesus da Silva Lima** do usuário **nadinbnd53@gmail.com** (Ray Dias) possui duas parcelas com a mesma data:

- **ID do Empréstimo:** `3a66c416-dba5-4a83-948f-9ed42271013f`
- **Parcelas atuais:** `[2026-02-04, 2026-02-04, 2026-03-04, ...]`
- **Erro:** Parcelas 1 e 2 estão com a mesma data (04/02/2026)

## Correção Necessária

Considerando que o `start_date` é 04/01/2026 e são 12 parcelas mensais, a primeira parcela deveria ser em Janeiro, não Fevereiro duplicado.

**Datas corrigidas:**
```text
1.  04/01/2026  (era 04/02 duplicado)
2.  04/02/2026
3.  04/03/2026
4.  04/04/2026
5.  04/05/2026
6.  04/06/2026
7.  04/07/2026
8.  04/08/2026
9.  04/09/2026
10. 04/10/2026
11. 04/11/2026
12. 04/12/2026
```

## Ação

Executar UPDATE direto no banco de dados para corrigir o array `installment_dates`:

```sql
UPDATE loans
SET installment_dates = '["2026-01-04", "2026-02-04", "2026-03-04", "2026-04-04", "2026-05-04", "2026-06-04", "2026-07-04", "2026-08-04", "2026-09-04", "2026-10-04", "2026-11-04", "2026-12-04"]'::jsonb
WHERE id = '3a66c416-dba5-4a83-948f-9ed42271013f';
```

## Resultado Esperado

1. As 12 parcelas terão datas únicas e sequenciais (dia 04 de cada mês)
2. O calendário exibirá corretamente cada parcela
3. O empréstimo funcionará normalmente para registro de pagamentos

