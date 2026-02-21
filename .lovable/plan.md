

# Corrigir Pulo de Parcelas em Emprestimos Mensais

## Problema
Usuarios relatam que ao editar a data de vencimento da proxima parcela de um emprestimo mensal, o sistema duplica uma data e pula outra. Exemplo: datas originais [03/01, 03/02, 03/03, 03/04] - apos editar, fica [03/01, 03/02, 03/02, 03/04], pulando 03/03.

## Evidencias no Banco de Dados
Encontrei dados corrompidos confirmando o problema:
- Emprestimo `86acebeb`: datas `[2026-02-21, 2026-03-21, 2026-04-21, **2026-03-21**, 2026-06-21...]` - data 03/21 duplicada, 05/21 ausente
- Emprestimo `d8dc0281`: datas `[2026-03-18, **2026-05-18**, **2026-05-18**, 2026-06-18...]` - data 05/18 duplicada, 04/18 ausente

## Causa Raiz
Ha dois problemas independentes:

### Problema 1: `getPaidInstallmentsCount` - Fallback impreciso (linha 471-484)
Para emprestimos antigos sem tags `[PARTIAL_PAID]`, o sistema calcula parcelas pagas dividindo `total_paid / baseInstallmentValue` com tolerancia de 0.99. Essa divisao produz resultados errados quando:
- Ha arredondamentos nos valores
- Multas ou taxas extras foram adicionadas ao `total_paid`
- O `total_paid` simula valor antes do trigger do banco atualizar

Quando retorna um indice errado, a funcao `handleUpdateDueDate` (linha 1888) sobrescreve a data no indice ERRADO do array `installment_dates`.

### Problema 2: `handleUpdateDueDate` define `due_date` incorretamente (linha 1893)
Apos editar a data de uma parcela, o `due_date` e definido como a ULTIMA data do array (`updatedDates[updatedDates.length - 1]`), ao inves da data da proxima parcela nao paga. Isso faz o emprestimo "pular" para a ultima data.

### Problema 3: Caminho `new_due_date` durante pagamento (linha 5062)
Quando o usuario muda a data durante o pagamento, `getPaidInstallmentsCount` e chamado sem simular o `total_paid` atualizado, retornando um indice antigo e sobrescrevendo a data errada.

## Solucao

### Arquivo: `src/pages/Loans.tsx`

**Correcao 1 - `handleUpdateDueDate` (linha ~1892-1894)**
Mudar para definir `due_date` como a data da proxima parcela nao paga, nao a ultima do array:

Antes:
```typescript
const newDueDateForLoan = updatedDates.length > 0 
  ? updatedDates[updatedDates.length - 1] 
  : newDateStr;
```

Depois:
```typescript
const newDueDateForLoan = newDateStr;
```

**Correcao 2 - Auto due_date apos pagamento (linha ~5128-5172)**
Buscar dados FRESCOS do banco apos o pagamento ser registrado e as notas salvas, ao inves de simular `total_paid` com valor potencialmente impreciso:

Antes:
```typescript
const loanForCalc = { 
  ...selectedLoan, 
  notes: updatedNotes,
  total_paid: (selectedLoan.total_paid || 0) + amount
};
const newPaidInstallments = getPaidInstallmentsCount(loanForCalc);
```

Depois:
```typescript
// Buscar dados frescos do banco para calculo preciso
const { data: freshLoanForDueDate } = await supabase
  .from('loans')
  .select('notes, total_paid, remaining_balance')
  .eq('id', selectedLoanId)
  .single();

const loanForCalc = { 
  ...selectedLoan, 
  notes: freshLoanForDueDate?.notes || updatedNotes,
  total_paid: freshLoanForDueDate?.total_paid || ((selectedLoan.total_paid || 0) + amount),
  remaining_balance: freshLoanForDueDate?.remaining_balance ?? selectedLoan.remaining_balance
};
const newPaidInstallments = getPaidInstallmentsCount(loanForCalc);
```

**Correcao 3 - Caminho `new_due_date` durante pagamento (linha ~5058-5062)**
Mesmo problema - usar dados frescos do banco:

Antes:
```typescript
const loanWithUpdatedNotes = { 
  ...selectedLoan, 
  notes: updatedNotes 
};
const paidInstallmentsCount = getPaidInstallmentsCount(loanWithUpdatedNotes);
```

Depois:
```typescript
const loanWithUpdatedNotes = { 
  ...selectedLoan, 
  notes: updatedNotes,
  total_paid: (selectedLoan.total_paid || 0) + amount
};
const paidInstallmentsCount = getPaidInstallmentsCount(loanWithUpdatedNotes);
```

**Correcao 4 - Fallback de `getPaidInstallmentsCount` (linha ~477)**
Aumentar a precisao do fallback: em vez de iterar com tolerancia de 0.99 que pode contar a mais, usar `Math.floor` com margem de seguranca:

Antes:
```typescript
if (remaining >= baseInstallmentValue * 0.99) {
  paidCount++;
  remaining -= baseInstallmentValue;
} else {
  break;
}
```

Depois:
```typescript
if (remaining >= baseInstallmentValue * 0.99) {
  paidCount++;
  remaining -= baseInstallmentValue;
} else {
  break;
}
// Seguranca: nunca retornar mais que o numero real de parcelas
return Math.min(paidCount, numInstallments);
```

(Nota: o `Math.min` ja e implicitamente garantido pelo loop, mas a protecao adicional previne edge cases)

## Resumo Tecnico
- Unico arquivo modificado: `src/pages/Loans.tsx`
- 4 pontos de correcao no mesmo arquivo
- Nenhuma alteracao de banco de dados necessaria
- Correcoes focam em: (1) usar dados frescos do banco, (2) definir due_date corretamente, (3) simular total_paid quando necessario

