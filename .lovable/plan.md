
# Plano: Corrigir Cálculo de Datas de Parcelas Mensais

## Problema Identificado

Quando o usuário seleciona uma data inicial no dia 31 (ex: 31/01) para parcelas mensais:
- Janeiro: 31/01 ✓
- Fevereiro: Deveria ser 28/02, mas está mostrando 03/03 ✗
- Março: 31/03 (depois volta ao normal)

**Causa raiz:** O código usa `setDate(dueDate, 31)` para forçar o dia 31 em fevereiro, mas JavaScript "transborda" a data para o mês seguinte (31 de fevereiro = 3 de março).

## Solução

Usar `getDaysInMonth` do `date-fns` para calcular o número máximo de dias do mês e ajustar o dia da parcela para não exceder esse limite.

**Lógica corrigida:**
```text
dia_desejado = 31 (original)
dias_no_mes_fevereiro = 28
dia_final = min(31, 28) = 28
```

## Alterações Técnicas

### Arquivo: `src/pages/ProductSales.tsx`

**1. Adicionar import:**
```typescript
// Linha 44 - adicionar getDaysInMonth
import { format, parseISO, isPast, isToday, addMonths, addDays, getDate, setDate, getDaysInMonth } from 'date-fns';
```

**2. Corrigir lógica de geração de datas (linhas 520-528):**

Antes:
```typescript
dueDate = addMonths(firstDate, i);
try {
  dueDate = setDate(dueDate, dayOfMonth);
} catch {
  // Handle edge cases
}
```

Depois:
```typescript
dueDate = addMonths(firstDate, i);
// Ajustar o dia para não exceder o máximo do mês
// Ex: 31/01 -> 28/02 (não 03/03)
const maxDaysInMonth = getDaysInMonth(dueDate);
const adjustedDay = Math.min(dayOfMonth, maxDaysInMonth);
dueDate = setDate(dueDate, adjustedDay);
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
| ...     | ...            | ...              |

O sistema sempre usará o último dia do mês quando o dia desejado não existir naquele mês.
