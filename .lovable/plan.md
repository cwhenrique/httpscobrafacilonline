
# Corrigir Calendário para Exibir Empréstimos Semanais e Quinzenais

## Problema Identificado

O empréstimo semanal do cliente **Elias Ferreira de Melo** não aparece no calendário de cobranças para a data 06/02/2026 porque a lógica de processamento de parcelas no calendário **não inclui os tipos `weekly` e `biweekly`**.

### Dados do Empréstimo no Banco

| Campo | Valor |
|-------|-------|
| Cliente | Elias Ferreira de Melo |
| Tipo | `weekly` (semanal) |
| Parcelas | 8 |
| Datas das Parcelas | 06/02, 09/02, 16/02, 23/02, 02/03, 09/03, 16/03, 23/03 |
| Due Date Final | 23/03/2026 |

### Código Atual (linha 159)

```typescript
if ((loan.payment_type === 'installment' || loan.payment_type === 'daily') && loan.installment_dates)
```

O problema: empréstimos `weekly` e `biweekly` **não estão incluídos**, então caem no bloco `else` que usa apenas o `due_date` final (23/03), ignorando as 8 datas de parcelas individuais.

## Solução

Incluir os tipos `weekly` e `biweekly` na condição que processa as datas de parcelas.

## Alteração Técnica

### Arquivo: `src/pages/CalendarView.tsx`

**Linha 159 - Adicionar weekly e biweekly à condição:**

```typescript
// De:
if ((loan.payment_type === 'installment' || loan.payment_type === 'daily') && loan.installment_dates)

// Para:
if ((loan.payment_type === 'installment' || loan.payment_type === 'daily' || loan.payment_type === 'weekly' || loan.payment_type === 'biweekly') && loan.installment_dates)
```

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/CalendarView.tsx` | Linha 159 - Adicionar `weekly` e `biweekly` à condição de processamento de parcelas |

## Resultado Esperado

Após a correção:
- O empréstimo do Elias Ferreira de Melo aparecerá no calendário em **todas as 8 datas de parcelas**: 06/02, 09/02, 16/02, 23/02, 02/03, 09/03, 16/03 e 23/03
- Todos os empréstimos semanais e quinzenais passarão a exibir cada parcela individualmente no calendário
- O comportamento será consistente com empréstimos diários e mensais parcelados
