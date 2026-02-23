

## Corrigir exibicao de valores individuais no modo "Parcelas Personalizadas"

### Problema

Ao criar um emprestimo com "Parcelas Personalizadas" (custom), os valores individuais (ex: 250, 300, 400, 500, 700) sao ignorados na exibicao. Todas as parcelas mostram o mesmo valor (430), que e a media simples (total 2150 / 5 parcelas = 430).

### Causa Raiz

Existem **duas funcoes** `getInstallmentValue` no arquivo `Loans.tsx`:

1. **Linha ~113** (dentro de `getPaidIndicesFromNotes`): Corretamente verifica `custom` e usa `parseCustomInstallments` para retornar o valor individual
2. **Linha ~458** (dentro de `getPaidInstallmentsCount`): NAO verifica `custom`, retorna `baseInstallmentValue` (media) para todas as parcelas

Alem disso, a funcao **`getEffectiveInstallmentValue`** (linha ~193) tambem nao trata o modo `custom`.

Esses helpers sao usados em toda a interface para exibir o valor de cada parcela, calcular se esta paga, e determinar valores pendentes.

### Solucao

Adicionar tratamento do modo `custom` nas funcoes que faltam:

**Arquivo: `src/pages/Loans.tsx`**

**Correcao 1 - `getPaidInstallmentsCount` (linha ~458-466):**
Adicionar verificacao de custom antes do fallback:

```typescript
const getInstallmentValue = (index: number) => {
  if (renewalFeeInstallmentIndex !== null && index === renewalFeeInstallmentIndex) {
    return renewalFeeValue;
  }
  // Parcelas personalizadas: usar valor individual
  if (loan.interest_mode === 'custom') {
    const customValues = parseCustomInstallments(loan.notes);
    if (customValues && index < customValues.length) return customValues[index];
  }
  if (loan.interest_mode === 'sac') {
    return calculateSACInstallmentValue(...);
  }
  return baseInstallmentValue;
};
```

**Correcao 2 - `getEffectiveInstallmentValue` (linha ~193-224):**
Adicionar verificacao de custom:

```typescript
if (loan.interest_mode === 'custom' && !isDaily) {
  const customValues = parseCustomInstallments(loan.notes);
  if (customValues && paidInstallmentsCount < customValues.length) {
    return customValues[paidInstallmentsCount];
  }
}
```

**Correcao 3 - Verificar todos os outros locais** no arquivo que calculam `installmentValue` sem considerar custom (busca completa por `baseInstallmentValue` e `installmentValue` no contexto de exibicao de parcelas), garantindo que cada parcela exiba seu valor real quando o modo for `custom`.

### Resultado Esperado

Apos a correcao, ao criar um emprestimo com parcelas personalizadas de 250, 300, 400, 500 e 700, cada parcela exibira seu valor individual correto na listagem de vencimentos.

