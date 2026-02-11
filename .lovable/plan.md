
# Correcao do Bug de Amortizacao Duplicada

## Problema

Ao fazer uma segunda amortizacao, o sistema desconta o valor das amortizacoes anteriores duas vezes:

1. O `principal_amount` no banco ja foi atualizado para o valor reduzido (ex: 900 apos amortizar 100 de 1000)
2. O codigo le esse valor reduzido (900) e ainda subtrai as amortizacoes anteriores das notas (100)
3. Resultado: 900 - 100 - 100 = 700, quando deveria ser 900 - 100 = 800

## Correcao

Uma unica alteracao na linha 4684 de `src/pages/Loans.tsx`:

```typescript
// ANTES (bug - desconta previousAmortizations duas vezes):
const newPrincipal = Math.max(0, originalPrincipal - previousAmortizations - amount);

// DEPOIS (correto - principal_amount ja reflete amortizacoes anteriores):
const newPrincipal = Math.max(0, originalPrincipal - amount);
```

Como o `principal_amount` no banco ja e atualizado a cada amortizacao (linha 4703), nao ha necessidade de subtrair `previousAmortizations` novamente.

A variavel `previousAmortizations` continuara sendo calculada pois e usada na nota de reversao (linha 4717), garantindo que a funcionalidade de reverter amortizacoes continue funcionando.

## Detalhes Tecnicos

- **Arquivo**: `src/pages/Loans.tsx`, linha 4684
- **Impacto**: Apenas a logica de calculo do novo principal na amortizacao
- **Sem efeitos colaterais**: A tag de amortizacao e a nota de reversao continuam usando os valores corretos
