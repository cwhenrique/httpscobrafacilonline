
# Correção: Parcela Paga Aparecendo Como em Atraso

## Problema Identificado

O empréstimo mensal de **PRISCILA MARIA LEITE DA SILVA** mostra a Parcela 1/5 como "em atraso" mesmo após o pagamento de R$ 500,00 ter sido registrado em 27/01/2026.

### Análise de Dados

| Campo | Valor |
|-------|-------|
| Loan ID | `1eeedd82-c83d-46bc-ba28-c188d56b5ac5` |
| total_paid | R$ 500,00 |
| remaining_balance | R$ 2.000,05 |
| notes | `"FINAL. 07"` (SEM tag `[PARTIAL_PAID:...]`) |
| Valor da parcela | R$ 500,01 (2500.05 / 5) |

### Causa Raiz

A função `getPaidInstallmentsCount` não está reconhecendo a parcela como paga porque:

1. **Tag de tracking ausente**: A tag `[PARTIAL_PAID:0:500.00]` não foi salva nas notas do empréstimo durante o registro do pagamento
2. **Fallback ineficaz**: O fallback que calcula parcelas pagas pelo `total_paid` usa `Math.floor(totalPaid / baseInstallmentValue)`:
   - `Math.floor(500.00 / 500.01) = 0`
   - Resultado: 0 parcelas pagas (incorreto)

O pagamento de R$ 500,00 é 99.98% do valor da parcela (R$ 500,01), mas o `Math.floor` retorna 0.

## Solucao

Aplicar tolerancia de 1% no calculo de fallback, similar a verificacao usada em outros lugares do codigo.

## Alteracoes Tecnicas

### Arquivo: `src/pages/Loans.tsx`

**Linhas 314-317 - Corrigir calculo do fallback:**

```typescript
// ANTES:
if (!hasTrackingTags && !hasInterestOnlyTags && totalPaid > 0 && baseInstallmentValue > 0) {
  const paidByValue = Math.floor(totalPaid / baseInstallmentValue);
  return Math.min(paidByValue, numInstallments);
}

// DEPOIS:
if (!hasTrackingTags && !hasInterestOnlyTags && totalPaid > 0 && baseInstallmentValue > 0) {
  // Usar tolerancia de 1% para lidar com diferencas de centavos
  // Se pagou 99% ou mais de uma parcela, considerar como paga
  let paidCount = 0;
  let remaining = totalPaid;
  for (let i = 0; i < numInstallments && remaining > 0; i++) {
    if (remaining >= baseInstallmentValue * 0.99) {
      paidCount++;
      remaining -= baseInstallmentValue;
    } else {
      break;
    }
  }
  return paidCount;
}
```

### Correcao de Dados Existentes

Alem da correcao de codigo, preciso adicionar a tag `[PARTIAL_PAID:0:500.01]` nas notas do emprestimo da Priscila Maria para corrigir o estado atual:

```sql
UPDATE loans 
SET notes = 'FINAL. 07 [PARTIAL_PAID:0:500.01]'
WHERE id = '1eeedd82-c83d-46bc-ba28-c188d56b5ac5';
```

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Loans.tsx` | Corrigir fallback em `getPaidInstallmentsCount` para usar tolerancia de 99% |

## Resultado Esperado

Apos a correcao:
- A Parcela 1/5 sera reconhecida como paga
- O emprestimo nao aparecera mais como "em atraso"
- Outros emprestimos com diferencas de centavos entre pagamento e valor da parcela serao tratados corretamente
