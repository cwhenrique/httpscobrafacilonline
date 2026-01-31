
# Plano: Cascata de Datas Pulando Sábado/Domingo no Editar Parcelas Diárias

## Problema Identificado

Ao editar a data de uma parcela em empréstimos diários:
- **Funciona:** A cascata atualiza todas as parcelas subsequentes (ex: dia 09 → dia 10, então dia 10 → dia 11, dia 11 → dia 12...)
- **Não funciona:** Se a opção "pular sábado/domingo" estiver marcada, a cascata NÃO respeita essa regra

**Exemplo:**
- Cliente devia pagar dia 09 (sexta), não pagou
- Usuário edita para dia 10 (sábado) — mas se "pular sábado" está ativo, deveria ir para dia 12 (segunda)
- As parcelas seguintes também precisam respeitar essa regra

## Causa Raiz

A função `handleUpdateSpecificDate` (linha 1784-1849) apenas soma dias às datas seguintes:

```typescript
// CÓDIGO ATUAL (linha 1805-1809)
for (let i = index + 1; i < updatedDates.length; i++) {
  const originalDate = new Date(currentDates[i] + 'T12:00:00');
  originalDate.setDate(originalDate.getDate() + diffDays);
  updatedDates[i] = format(originalDate, 'yyyy-MM-dd');
}
```

Não há verificação se a nova data cai em sábado, domingo ou feriado.

## Solução

Ler as configurações de pular dias do `loan.notes` e regenerar as datas subsequentes usando a função existente `generateDailyDates`:

### Lógica Corrigida

1. Verificar se o empréstimo tem tags `[SKIP_SATURDAY]`, `[SKIP_SUNDAY]`, `[SKIP_HOLIDAYS]` nas notas
2. Atualizar a data da parcela editada
3. Se a nova data cair em dia pulado, avançar até encontrar dia válido
4. Para as parcelas seguintes, regenerar usando `generateDailyDates` a partir da nova data

## Alterações Técnicas

### Arquivo: `src/pages/Loans.tsx`

**Função `handleUpdateSpecificDate` (linhas 1784-1849):**

```text
ANTES:
1. Atualiza a data da parcela selecionada
2. Calcula diferença de dias entre data antiga e nova
3. Soma essa diferença a TODAS as datas seguintes

DEPOIS:
1. Ler configurações de pular dias do loan.notes
2. Atualiza a data da parcela selecionada
3. Se a data cair em dia pulado → avançar até dia válido
4. Para parcelas seguintes → regenerar usando generateDailyDates
   - Inicia no dia seguinte à parcela editada
   - Respeita sábado/domingo/feriados conforme configuração
```

### Código da Correção

Na função `handleUpdateSpecificDate`:

```typescript
// Ler configurações de pular dias das notas do empréstimo
const loanNotes = loan.notes || '';
const skipSat = loanNotes.includes('[SKIP_SATURDAY]');
const skipSun = loanNotes.includes('[SKIP_SUNDAY]');
const skipHol = loanNotes.includes('[SKIP_HOLIDAYS]');

// Ajustar a data selecionada se cair em dia pulado
let adjustedNewDate = new Date(newDateStr + 'T12:00:00');
while (
  (skipSat && adjustedNewDate.getDay() === 6) || 
  (skipSun && adjustedNewDate.getDay() === 0) || 
  (skipHol && isHoliday(adjustedNewDate))
) {
  adjustedNewDate.setDate(adjustedNewDate.getDate() + 1);
}
updatedDates[index] = format(adjustedNewDate, 'yyyy-MM-dd');

// Regenerar datas subsequentes respeitando dias pulados
if (index + 1 < updatedDates.length) {
  const remainingCount = updatedDates.length - index - 1;
  const nextDay = new Date(adjustedNewDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const newSubsequentDates = generateDailyDates(
    format(nextDay, 'yyyy-MM-dd'), 
    remainingCount, 
    skipSat, 
    skipSun, 
    skipHol
  );
  
  for (let i = 0; i < newSubsequentDates.length; i++) {
    updatedDates[index + 1 + i] = newSubsequentDates[i];
  }
}
```

## Comportamento Esperado

**Cenário:** Empréstimo diário com 5 parcelas, "pular sábado e domingo" marcado

| Parcela | Data Atual | Usuário Edita Para | Resultado |
|---------|------------|-------------------|-----------|
| 1ª | 09/01 (qui) | — | 09/01 (qui) |
| 2ª | 10/01 (sex) | Edita para 11/01 (sáb) | 13/01 (seg) ← pula sáb/dom |
| 3ª | 11/01 (sáb) | — | 14/01 (ter) ← regenerado |
| 4ª | 13/01 (seg) | — | 15/01 (qua) ← regenerado |
| 5ª | 14/01 (ter) | — | 16/01 (qui) ← regenerado |

## Resumo das Alterações

1. **`src/pages/Loans.tsx`** - Modificar função `handleUpdateSpecificDate`:
   - Ler tags `[SKIP_*]` do `loan.notes`
   - Ajustar a data editada se cair em dia pulado
   - Regenerar datas subsequentes usando `generateDailyDates` com as configurações corretas

## Arquivos Afetados

- `src/pages/Loans.tsx` (apenas 1 arquivo)
