

## Bug: Configuração de juros por atraso não é salva em empréstimos diários

### Causa Raiz

O formulário de empréstimo diário usa `handleDailySubmit` (linha 3208), que constrói as `notes` do empréstimo **sem incluir** a tag `[OVERDUE_CONFIG:...]`. O checkbox e campos de configuração existem na UI (linhas 7209-7266), mas o valor nunca é gravado nas notas.

Em contraste, o `handleSubmit` regular (linha 3905-3909) faz:
```typescript
if (formData.overdue_penalty_enabled && formData.overdue_penalty_value) {
  const penaltyConfig = `[OVERDUE_CONFIG:${formData.overdue_penalty_type}:${formData.overdue_penalty_value}]`;
  notes = `${penaltyConfig}\n${notes}`.trim();
}
```

Mas `handleDailySubmit` monta as notas na linha 3336-3341 e nunca adiciona essa tag.

### Correção

Em `src/pages/Loans.tsx`, no `handleDailySubmit`, adicionar a tag `[OVERDUE_CONFIG]` nas notas antes de construir o `loanData`.

**Linha ~3279** (após construir `skipTagsStr` e `details`), adicionar:

```typescript
// Add overdue penalty configuration if enabled
let overdueTag = '';
if (formData.overdue_penalty_enabled && formData.overdue_penalty_value) {
  overdueTag = `[OVERDUE_CONFIG:${formData.overdue_penalty_type}:${formData.overdue_penalty_value}]\n`;
}
```

E nas linhas 3336-3341 (construção das notes no loanData), incluir `overdueTag`:

```typescript
notes: (() => {
  if (formData.is_historical_contract) {
    return `[HISTORICAL_CONTRACT]\n${overdueTag}${skipTagsStr}${finalNotes ? finalNotes + '\n' : ''}${details}`;
  }
  return `${overdueTag}${skipTagsStr}${finalNotes ? finalNotes + '\n' : ''}${details}`;
})(),
```

E também na linha 3296 (modo edição), incluir `overdueTag`:

```typescript
const updatedNotes = `${historicalTags}${overdueTag}${skipTagsStr}${finalNotes ? finalNotes + '\n' : ''}${details}${partialPaidTags ? '\n' + partialPaidTags : ''}${historicalInterestTag}`.trim();
```

Isso garante que a tag `[OVERDUE_CONFIG:percentage:5]` (por exemplo) seja gravada nas notas do empréstimo diário, permitindo que a Edge Function `check-overdue-loans` detecte e aplique as multas automaticamente.

