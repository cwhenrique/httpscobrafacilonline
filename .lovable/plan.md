
## Corrigir formula do calculo proporcional no Desconto de Cheque

### Problema

A formula atual para "Proporcional aos dias" calcula: `(taxa / 30) * dias * valor`. Para 1040 dias a 10%, isso resulta em 346% de desconto (R$ 3.466,67), gerando valor a pagar negativo (-R$ 2.466,67). O correto seria calcular por meses: 10% * ~34 meses, mas limitando o desconto ao valor do cheque.

Na pratica, o usuario espera:
- Cheque de R$ 1.000 a 10% ao mes, 1 mes = desconto R$ 100, pagar R$ 900
- 2 meses = desconto R$ 200, pagar R$ 800
- E assim por diante, com desconto nunca ultrapassando o valor do cheque

### Solucao

Alterar a funcao `calculateDiscountAmount` em `src/types/checkDiscount.ts` para limitar o desconto ao valor nominal do cheque usando `Math.min`:

```typescript
// Proporcional: taxa mensal aplicada proporcionalmente aos dias
const proportionalRate = (discountRate / 30) * daysUntilDue;
const rawDiscount = nominalValue * (proportionalRate / 100);
return Math.min(rawDiscount, nominalValue); // nunca exceder o valor do cheque
```

Tambem aplicar o mesmo limite para o modo percentual fixo, por seguranca.

### Arquivo alterado

**`src/types/checkDiscount.ts`** - Funcao `calculateDiscountAmount` (~linha 96-109): adicionar `Math.min(..., nominalValue)` no retorno para ambos os tipos de desconto.
