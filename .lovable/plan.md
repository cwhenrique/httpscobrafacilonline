

## Corrigir calculo proporcional no Desconto de Cheque

### Problema

A funcao `getDaysUntilDue` usa `Math.max(0, diffDays)`, o que faz com que quando a data de vencimento e anterior ou igual a data do desconto, o numero de dias retorne 0. Isso zera o desconto no modo "Proporcional aos dias", resultando em lucro R$ 0,00 e valor a pagar = valor nominal.

No screenshot do usuario: data desconto = 23/02/2026, vencimento = 20/04/2023 (no passado), entao dias = 0 e desconto = 0.

### Solucao

Usar o valor absoluto dos dias entre as duas datas em vez de limitar a zero. Isso garante que o calculo funcione independente da ordem das datas.

### Alteracoes

**Arquivo: `src/types/checkDiscount.ts`**

Alterar a funcao `getDaysUntilDue` para usar `Math.abs` em vez de `Math.max(0, ...)`:

```
// De:
return Math.max(0, diffDays);

// Para:
return Math.max(1, Math.abs(diffDays));
```

Usar `Math.max(1, ...)` garante que mesmo com datas iguais, pelo menos 1 dia seja considerado no calculo, evitando desconto zero inesperado.

### Impacto

- Afeta apenas o calculo proporcional (tipo "proportional")
- O tipo "percentage" (percentual fixo) nao usa dias, entao nao e afetado
- A funcao e usada tanto no frontend (preview do formulario e hook `useCheckDiscounts`) quanto nas funcoes de backend
- Nenhuma outra parte do sistema usa essa funcao

