
## Correção: Opções de Pagamento no Template Padrão

### Problemas Identificados

**1. Bug da multa no template padrão (mesmo bug já corrigido para templates customizados)**

Na linha 247 de `SendOverdueNotification.tsx`, no caminho do template padrão (checkboxes), o cálculo da multa ignora multas dinâmicas:
```
const appliedPenalty = hasManualPenalty ? data.manualPenaltyAmount! : 0;
```
Precisa considerar `hasDynamicPenalty` e `totalPenaltyAmount`, igual ao fix já aplicado no caminho de templates customizados.

**2. Função `generatePaymentOptions` retorna vazio quando não deveria**

Em `src/lib/messageUtils.ts` (linha 194), a função retorna vazio se:
- `interestAmount` for 0 (empréstimo sem juros de contrato)
- `isDaily` for true (empréstimo diário)

Porem, mesmo nesses casos, se houver multa ou juros por atraso, o usuario quer ver as opções de pagamento mostrando os encargos.

### Correções Planejadas

**Arquivo 1: `src/components/SendOverdueNotification.tsx`**

Linha 247 - corrigir calculo da `appliedPenalty` no caminho padrão (checkboxes):

```typescript
// ANTES:
const appliedPenalty = hasManualPenalty ? data.manualPenaltyAmount! : 0;

// DEPOIS:
const dynamicPenalty = data.hasDynamicPenalty ? (data.totalPenaltyAmount || 0) : 0;
const manualPenalty = data.manualPenaltyAmount || 0;
const appliedPenalty = data.hasDynamicPenalty ? dynamicPenalty : manualPenalty;
```

**Arquivo 2: `src/lib/messageUtils.ts`**

Linha 194 - modificar `generatePaymentOptions` para mostrar opcoes quando houver multa ou juros por atraso, mesmo sem juros de contrato:

```typescript
// ANTES:
if (!interestAmount || interestAmount <= 0 || isDaily || !principalAmount || principalAmount <= 0) {
    return '';
}

// DEPOIS:
const hasContractInterest = interestAmount && interestAmount > 0;
const hasExtras = (penaltyAmount || 0) > 0 || (overdueInterestAmount || 0) > 0;

// Se nao tem juros de contrato NEM encargos extras, nao mostra nada
if (!hasContractInterest && !hasExtras) return '';
if (!principalAmount || principalAmount <= 0) return '';
```

Tambem ajustar a logica de exibicao para quando so tem encargos extras (sem juros de contrato):

- Se tem juros de contrato: mostra "Valor total" e "So juros" (comportamento atual)
- Se NAO tem juros de contrato mas TEM multa/juros atraso: mostra "Valor total" e "So encargos" (multa + juros atraso)
- Para emprestimos diarios com encargos: tambem mostrar opcao de pagar so encargos

### Impacto

- Usuarios com template padrao verao as opcoes de pagamento quando houver multa ou juros por atraso
- A opcao "So juros" mostrara o valor consolidado de juros + multa quando ambos existirem
- Emprestimos diarios com multa tambem mostrarao a opcao de pagar so encargos
- Nenhuma alteracao em templates customizados (ja corrigidos anteriormente)
