
# Corrigir Dupla Contagem de Juros no Fluxo de Caixa

## Problema

O Fluxo de Caixa esta somando "Pagamentos recebidos" (R$12.574) + "Juros recebidos" (R$2.462) = R$15.036, porem os R$2.462 de juros ja estao incluidos nos R$12.574 de pagamentos. O valor correto de entradas e R$12.574.

A causa esta na linha 84 do `CashFlowCard.tsx`:
```
totalInflows = receivedInPeriod + interestReceived
```

`receivedInPeriod` ja contem os juros (e a soma de `payment.amount`, que inclui principal + juros). Somar `interestReceived` novamente causa dupla contagem.

## Solucao

Alterar o calculo de `totalInflows` para usar apenas `receivedInPeriod`, e exibir "Juros recebidos" como um **detalhamento informativo** (quanto dos pagamentos recebidos veio de juros), nao como uma entrada adicional.

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/components/reports/CashFlowCard.tsx` | Corrigir `totalInflows` para nao somar juros duas vezes. Exibir juros como subtotal informativo dentro de "Pagamentos recebidos". |

## Detalhes tecnicos

1. Mudar `totalInflows = receivedInPeriod` (remover `+ interestReceived`)
2. Atualizar `currentBalance` que tambem usa `totalInflows` (corrigido automaticamente)
3. Na secao visual de Entradas, manter "Pagamentos recebidos" como valor principal e mostrar "dos quais juros" como detalhe subordinado (indentado, texto menor), para o usuario entender a composicao sem dupla contagem
4. O header de Entradas mostrara o valor correto (R$12.574 no caso do usuario)
