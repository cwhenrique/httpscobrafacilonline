
# Plano: Consolidar Juros + Multa e Ajustar Opções de Pagamento

## Resumo da Solicitação

Quando houver **juros por atraso** E **multa**, a mensagem deve:
1. Mostrar os encargos **consolidados** em uma única linha
2. Nas opções de pagamento, oferecer **"pagar juros + multa"** (não só juros)

## Comportamento Esperado

| Cenário | Exibição Encargos | Opções de Pagamento |
|---------|-------------------|---------------------|
| Só juros (R$ 300) | 📈 Juros por Atraso: R$ 300 | ✅ Total: R$ 1.800 / ⚠️ Só juros: R$ 300 |
| Só multa (R$ 200) | ⚠️ Multa Aplicada: R$ 200 | ✅ Total: R$ 1.700 (sem opção "só multa") |
| Juros + Multa (R$ 300 + R$ 200) | 💰 Juros + Multa: R$ 500 | ✅ Total: R$ 2.000 / ⚠️ Juros + Multa: R$ 500 |

## Arquivos a Modificar

### 1. `src/lib/messageUtils.ts`

**Função `replaceTemplateVariables()`** - Consolidar encargos:

Atualmente gera linhas separadas:
```text
{MULTA} → "⚠️ *Multa Aplicada:* +R$ 200,00"
{JUROS} → "📈 *Juros por Atraso:* +R$ 300,00"
```

Nova lógica:
- Se **ambos > 0**: consolidar em uma linha `💰 *Juros + Multa:* R$ 500,00`
- Se **só um**: manter linha individual correspondente

**Função `generatePaymentOptions()`** - Ajustar opções:

Atualmente sempre mostra "Só juros + multa" quando há encargos.

Nova lógica:
- Se **só juros** (multa = 0): mostrar `⚠️ Só juros: R$ X`
- Se **juros + multa**: mostrar `⚠️ Juros + Multa: R$ X` (deixando claro que não dá pra pagar só juros)

### 2. `src/components/SendOverdueNotification.tsx`

**Função `generateOverdueMessage()`** (linhas 242-248):

Atualmente:
```typescript
if (config.includePenalty && overdueInterest > 0) {
  message += `📈 *Juros por Atraso (${data.daysOverdue}d):* +${formatCurrency(overdueInterest)}\n`;
}
if (config.includePenalty && appliedPenalty > 0) {
  message += `⚠️ *Multa Aplicada:* +${formatCurrency(appliedPenalty)}\n`;
}
```

Nova lógica:
```typescript
if (config.includePenalty) {
  if (overdueInterest > 0 && appliedPenalty > 0) {
    // Consolidado
    message += `💰 *Juros + Multa:* +${formatCurrency(overdueInterest + appliedPenalty)}\n`;
  } else if (overdueInterest > 0) {
    message += `📈 *Juros por Atraso (${data.daysOverdue}d):* +${formatCurrency(overdueInterest)}\n`;
  } else if (appliedPenalty > 0) {
    message += `⚠️ *Multa Aplicada:* +${formatCurrency(appliedPenalty)}\n`;
  }
}
```

**Função `generateSimpleOverdueMessage()`** (linhas 330-335):

Aplicar mesma consolidação.

### 3. `src/types/billingMessageConfig.ts`

Adicionar nova variável de template para mensagens customizadas:

```typescript
{ variable: '{JUROS_MULTA}', description: 'Juros + Multa consolidados (quando ambos existem)' }
```

## Exemplo Visual da Mensagem

**Antes (separado):**
```text
💵 *Valor da Parcela:* R$ 1.500,00
📈 *Juros por Atraso (5d):* +R$ 300,00
⚠️ *Multa Aplicada:* +R$ 200,00
💵 *TOTAL A PAGAR:* R$ 2.000,00

💡 *Opções de Pagamento:*
✅ Valor total: R$ 2.000,00
⚠️ Só juros + multa: R$ 500,00
```

**Depois (consolidado):**
```text
💵 *Valor da Parcela:* R$ 1.500,00
💰 *Juros + Multa:* +R$ 500,00
💵 *TOTAL A PAGAR:* R$ 2.000,00

💡 *Opções de Pagamento:*
✅ Valor total: R$ 2.000,00
⚠️ Juros + Multa: R$ 500,00
   (Parcela de R$ X segue para próximo mês)
```

**Quando só tem juros (sem multa):**
```text
💵 *Valor da Parcela:* R$ 1.500,00
📈 *Juros por Atraso (5d):* +R$ 300,00
💵 *TOTAL A PAGAR:* R$ 1.800,00

💡 *Opções de Pagamento:*
✅ Valor total: R$ 1.800,00
⚠️ Só juros: R$ 300,00
   (Parcela de R$ X segue para próximo mês)
```

## Seção Técnica

### Alteração em `generatePaymentOptions()`

```typescript
export const generatePaymentOptions = (
  totalAmount: number,
  interestAmount: number | undefined,
  principalAmount: number | undefined,
  isDaily: boolean | undefined,
  penaltyAmount?: number,
  overdueInterestAmount?: number
): string => {
  if (!interestAmount || interestAmount <= 0 || isDaily || !principalAmount || principalAmount <= 0) {
    return '';
  }
  
  const hasOverdueInterest = (overdueInterestAmount || 0) > 0;
  const hasPenalty = (penaltyAmount || 0) > 0;
  
  // Total de encargos (juros contrato + juros atraso + multa)
  const totalEncargos = interestAmount + (overdueInterestAmount || 0) + (penaltyAmount || 0);
  
  // Valor da parcela original
  const parcelaOriginal = principalAmount + interestAmount;
  
  let message = `💡 *Opções de Pagamento:*\n`;
  message += `✅ Valor total: ${formatCurrency(totalAmount)}\n`;
  
  if (hasOverdueInterest && hasPenalty) {
    // Quando tem AMBOS: opção é pagar juros + multa (não só juros)
    message += `⚠️ Juros + Multa: ${formatCurrency(totalEncargos)}\n`;
  } else {
    // Quando tem só juros (ou nenhum encargo extra)
    message += `⚠️ Só juros: ${formatCurrency(totalEncargos)}\n`;
  }
  
  message += `   (Parcela de ${formatCurrency(parcelaOriginal)} segue para próximo mês)\n\n`;
  
  return message;
};
```

## Impacto

- Mensagens ficam mais claras e objetivas
- Cliente entende que quando há multa, não pode pagar só juros
- Compatível com templates customizados (nova variável {JUROS_MULTA})
