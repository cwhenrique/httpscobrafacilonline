
# Plano: Corrigir Cálculo de Datas de Parcelas Mensais em Veículos

## Problema Identificado

O mesmo bug que foi corrigido em Vendas de Produtos está presente em Vendas de Veículos:

- Quando o usuário seleciona 31/01 como primeira data de vencimento
- Janeiro: 31/01 (correto)
- Fevereiro: Mostra 03/03 (errado - deveria ser 28/02)
- Março: 31/03 (correto)

**Causa:** O código usa `setDate(dueDate, 31)` para forçar o dia 31 em fevereiro, mas JavaScript "transborda" a data para o mês seguinte (31 de fevereiro = 3 de março).

## Solução

Aplicar a mesma correção usando `getDaysInMonth` do `date-fns`:

```text
dia_desejado = 31 (original)
dias_no_mes_fevereiro = 28
dia_final = min(31, 28) = 28
```

## Alterações Técnicas

### Arquivo 1: `src/components/VehicleForm.tsx`

**1. Adicionar import `getDaysInMonth`:**
```typescript
import { addMonths, addDays, format, setDate, getDate, parseISO, getDaysInMonth } from 'date-fns';
```

**2. Corrigir lógica de geração de datas (linhas 243-251):**

Antes:
```typescript
// Add 1 month for each installment (monthly)
dueDate = addMonths(firstDate, i);
// Keep the same day of month
try {
  dueDate = setDate(dueDate, dayOfMonth);
} catch {
  // If day doesn't exist in month (e.g., 31 in Feb), use last day
  dueDate = addMonths(firstDate, i);
}
```

Depois:
```typescript
// Add 1 month for each installment (monthly)
dueDate = addMonths(firstDate, i);
// Keep the same day of month, capped at month's max days
// Ex: 31/01 -> 28/02 (not 03/03)
const maxDaysInMonth = getDaysInMonth(dueDate);
const adjustedDay = Math.min(dayOfMonth, maxDaysInMonth);
dueDate = setDate(dueDate, adjustedDay);
```

---

### Arquivo 2: `src/hooks/useVehicles.ts`

**1. Adicionar import `getDaysInMonth` e funções necessárias:**
```typescript
import { addMonths, format, parseISO, getDate, setDate, getDaysInMonth } from 'date-fns';
```

**2. Corrigir lógica no `createVehicle` (linhas 234-248):**

Antes:
```typescript
for (let i = 0; i < data.installments; i++) {
  const dueDate = addMonths(parseISO(data.first_due_date), i);
  const dueDateStr = format(dueDate, 'yyyy-MM-dd');
  // ...
}
```

Depois:
```typescript
const firstDate = parseISO(data.first_due_date);
const dayOfMonth = getDate(firstDate);

for (let i = 0; i < data.installments; i++) {
  let dueDate = addMonths(firstDate, i);
  // Ajustar o dia para não exceder o máximo do mês
  // Ex: 31/01 -> 28/02 (não 03/03)
  const maxDaysInMonth = getDaysInMonth(dueDate);
  const adjustedDay = Math.min(dayOfMonth, maxDaysInMonth);
  dueDate = setDate(dueDate, adjustedDay);
  const dueDateStr = format(dueDate, 'yyyy-MM-dd');
  // ...
}
```

## Resultado Esperado

Com data inicial 31/01 e 12 parcelas mensais:

| Parcela | Antes (Errado) | Depois (Correto) |
|---------|----------------|------------------|
| 1ª      | 31/01          | 31/01            |
| 2ª      | 03/03          | 28/02            |
| 3ª      | 31/03          | 31/03            |
| 4ª      | 01/05          | 30/04            |
| 5ª      | 31/05          | 31/05            |
| 6ª      | 01/07          | 30/06            |
| ...     | ...            | ...              |

O sistema sempre usará o último dia do mês quando o dia desejado não existir naquele mês.

## Arquivos a Modificar

1. `src/components/VehicleForm.tsx` - Interface do formulário de veículos
2. `src/hooks/useVehicles.ts` - Hook que processa e salva os dados

## Consistência

Essa correção segue exatamente o mesmo padrão já aplicado em:
- `src/pages/ProductSales.tsx`
- `src/hooks/useProductSales.ts`
- Conforme documentado na memória `features/monthly-installment-date-logic`
