

# Plano: Incluir Pagamento Parcial de Juros nas Mensagens de Cobrança

## O que você quer

Quando houver pagamento parcial de juros registrado, as mensagens de WhatsApp de cobrança (atraso, vence hoje, antes do prazo) devem incluir:
- Quanto foi pago de juros parcialmente
- Quanto ainda falta pagar de juros

---

## Alterações Necessárias

### 1. Adicionar campos nas interfaces de dados dos componentes

#### SendDueTodayNotification.tsx (linhas 13-28)

Adicionar na interface `DueTodayData`:
```typescript
// NOVO: Pagamento parcial de juros
partialInterestPaid?: number;    // Valor já pago de juros parcialmente
partialInterestPending?: number; // Valor que ainda falta de juros
```

#### SendOverdueNotification.tsx (linhas 13-54)

Adicionar na interface `OverdueData`:
```typescript
// NOVO: Pagamento parcial de juros
partialInterestPaid?: number;
partialInterestPending?: number;
```

#### SendEarlyNotification.tsx (linhas 13-29)

Adicionar na interface `EarlyNotificationData`:
```typescript
// NOVO: Pagamento parcial de juros
partialInterestPaid?: number;
partialInterestPending?: number;
```

---

### 2. Modificar as funções de geração de mensagem

#### Em SendDueTodayNotification.tsx

Nas funções `generateDueTodayMessage()` e `generateSimpleDueTodayMessage()`, adicionar seção:

```typescript
// Pagamento parcial de juros (se houver)
if (data.partialInterestPaid && data.partialInterestPaid > 0) {
  message += `\n💜 *JUROS PARCIAL:*\n`;
  message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
  message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
}
```

#### Em SendOverdueNotification.tsx

Nas funções `generateOverdueMessage()` e `generateSimpleOverdueMessage()`, adicionar seção similar:

```typescript
// Pagamento parcial de juros (se houver)
if (data.partialInterestPaid && data.partialInterestPaid > 0) {
  message += `\n💜 *JUROS PARCIAL:*\n`;
  message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
  message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
}
```

#### Em SendEarlyNotification.tsx

Nas funções `generateEarlyMessage()` e `generateSimpleEarlyMessage()`, adicionar seção similar:

```typescript
// Pagamento parcial de juros (se houver)
if (data.partialInterestPaid && data.partialInterestPaid > 0) {
  message += `\n💜 *JUROS PARCIAL:*\n`;
  message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
  message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
}
```

---

### 3. Atualizar chamadas em Loans.tsx

Passar os novos dados de pagamento parcial em cada chamada dos componentes de notificação.

#### SendOverdueNotification (linha ~8297)

```typescript
<SendOverdueNotification
  data={{
    // ... campos existentes ...
    // NOVO: Calcular e passar pagamento parcial de juros
    partialInterestPaid: (() => {
      const paidList = getPartialInterestPaidFromNotes(loan.notes);
      const currentIndex = getPaidInstallmentsCount(loan);
      return paidList
        .filter(p => p.installmentIndex === currentIndex)
        .reduce((sum, p) => sum + p.amountPaid, 0);
    })(),
    partialInterestPending: (() => {
      const paidList = getPartialInterestPaidFromNotes(loan.notes);
      const currentIndex = getPaidInstallmentsCount(loan);
      const paidForCurrent = paidList
        .filter(p => p.installmentIndex === currentIndex)
        .reduce((sum, p) => sum + p.amountPaid, 0);
      return Math.max(0, calculatedInterestPerInstallment - paidForCurrent);
    })(),
  }}
/>
```

#### SendDueTodayNotification (linhas ~8336, ~8380)

Mesma lógica para calcular e passar `partialInterestPaid` e `partialInterestPending`.

#### SendEarlyNotification (linha ~8415)

Mesma lógica para calcular e passar os valores.

---

## Exemplo de Mensagem Resultante

### Antes (sem pagamento parcial):
```
⚠️ *Atenção João*
━━━━━━━━━━━━━━━━

💵 *Valor da Parcela:* R$ 1.200,00
📊 *Parcela 2/6*
📅 *Vencimento:* 25/01/2026
⏰ *Dias em Atraso:* 3

━━━━━━━━━━━━━━━━
_Empresa XYZ_
```

### Depois (com pagamento parcial de R$ 70 de R$ 200):
```
⚠️ *Atenção João*
━━━━━━━━━━━━━━━━

💵 *Valor da Parcela:* R$ 1.200,00
📊 *Parcela 2/6*
📅 *Vencimento:* 25/01/2026
⏰ *Dias em Atraso:* 3

💜 *JUROS PARCIAL:*
✅ Já pago: R$ 70,00
⏳ Pendente: R$ 130,00

━━━━━━━━━━━━━━━━
_Empresa XYZ_
```

---

## Fluxo Visual

```text
EMPRÉSTIMO COM PAGAMENTO PARCIAL DE JUROS
┌─────────────────────────────────────────────────┐
│  Cliente pagou R$ 70 de R$ 200 de juros        │
│  ↓                                              │
│  Card fica ROXO (já implementado)               │
│  ↓                                              │
│  Usuário clica "Enviar Cobrança"               │
│  ↓                                              │
│  Mensagem WhatsApp inclui:                      │
│  ┌─────────────────────────────────────────┐   │
│  │ 💜 *JUROS PARCIAL:*                     │   │
│  │ ✅ Já pago: R$ 70,00                    │   │
│  │ ⏳ Pendente: R$ 130,00                  │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/SendDueTodayNotification.tsx` | Adicionar campos `partialInterestPaid/Pending` na interface e nas funções de mensagem |
| `src/components/SendOverdueNotification.tsx` | Adicionar campos `partialInterestPaid/Pending` na interface e nas funções de mensagem |
| `src/components/SendEarlyNotification.tsx` | Adicionar campos `partialInterestPaid/Pending` na interface e nas funções de mensagem |
| `src/pages/Loans.tsx` | Calcular e passar os valores de pagamento parcial nas chamadas dos componentes (~8297, ~8336, ~8380, ~8415) |

