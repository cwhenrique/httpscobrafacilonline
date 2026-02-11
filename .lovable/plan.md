

# Correcao do Bug de Amortizacao na Preview (Dialog)

## Problema

A correcao anterior foi aplicada apenas na logica de **processamento** (linha 4684), mas o mesmo bug existe na **preview/dialog** de amortizacao (linha 12858). O dialog mostra o calculo ao usuario antes de confirmar, e esta fazendo a mesma subtracao duplicada.

Na screenshot: principal_amount no banco = 800 (ja amortizado), previousAmortizations das notas = 100. O dialog calcula: 800 - 100 - 100 = 600 (errado). Deveria ser: 800 - 100 = 700.

## Correcao

**Arquivo**: `src/pages/Loans.tsx`

**Linha 12858** - Remover a subtracao de `previousAmortizations` no calculo do `currentPrincipal`:

```typescript
// ANTES (bug):
const currentPrincipal = Math.max(0, originalPrincipal - previousAmortizations);

// DEPOIS (correto - principal_amount ja reflete amortizacoes anteriores):
const currentPrincipal = originalPrincipal;
```

**Linha 12864** - Ajustar juros originais para usar o principal atual (nao o historico original):

```typescript
// ANTES:
const originalInterest = originalPrincipal * (currentInterestRate / 100);

// DEPOIS:
const originalInterest = currentPrincipal * (currentInterestRate / 100);
```

Com isso, o label "Principal original" na preview continuara mostrando o `originalPrincipal` (que agora e o principal atual do banco, ex: 800), as "Amortizacoes anteriores" nao precisam mais ser exibidas (ja estao refletidas no principal), e o "Novo principal" sera calculado corretamente como 800 - 100 = 700.

A exibicao de "Amortizacoes anteriores" na preview pode ser removida (linhas 12902-12907) ja que essa informacao ja esta incorporada no principal_amount do banco e so confunde o usuario.

## Resumo das Alteracoes

| Linha | Mudanca |
|-------|---------|
| 12858 | `currentPrincipal = originalPrincipal` (sem subtrair previousAmortizations) |
| 12864 | Juros originais calculados sobre `currentPrincipal` |
| 12902-12907 | Remover exibicao de "Amortizacoes anteriores" (opcional, mas recomendado) |

