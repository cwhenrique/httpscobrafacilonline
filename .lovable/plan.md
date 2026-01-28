
# Plano: Card Roxo + Exibição do Juros Parcial Pago

## O que você quer

1. **Card com cor roxa** quando houver pagamento parcial de juros registrado (igual ao estilo "Só Juros")
2. **Mostrar valor já pago** abaixo de "Só Juros (por parcela)" quando houver pagamentos parciais de juros

---

## Alterações no Código

### Arquivo: src/pages/Loans.tsx

#### 1. Detectar pagamento parcial de juros para estilização do card

Na área onde `isInterestOnlyPayment` é definido (~linha 7297), adicionar:

```typescript
const isInterestOnlyPayment = loan.notes?.includes('[INTEREST_ONLY_PAYMENT]');

// NOVO: Detectar pagamentos parciais de juros
const hasPartialInterestPayments = 
  (loan.notes || '').includes('[PARTIAL_INTEREST_PAID:') ||
  (loan.notes || '').includes('[PARTIAL_INTEREST_PENDING:');
```

#### 2. Incluir na variável hasSpecialStyle

Na linha ~7507, modificar para incluir o novo indicador:

```typescript
// ANTES:
const hasSpecialStyle = isPaid || isOverdue || isRenegotiated || isInterestOnlyPayment || isWeekly || isBiweekly || isDaily || isCompound || hasDueTodayStyle;

// DEPOIS:
const hasSpecialStyle = isPaid || isOverdue || isRenegotiated || isInterestOnlyPayment || hasPartialInterestPayments || isWeekly || isBiweekly || isDaily || isCompound || hasDueTodayStyle;
```

#### 3. Adicionar caso no getCardStyle() para cards com pagamento parcial

Na função `getCardStyle()` (~linha 7513-7514), adicionar logo após o caso de `isInterestOnlyPayment`:

```typescript
if (isInterestOnlyPayment && !isOverdue) {
  return 'bg-purple-500/20 border-purple-400 dark:bg-purple-500/30 dark:border-purple-400';
}
// NOVO: Cards com pagamento parcial de juros também ficam roxos
if (hasPartialInterestPayments && !isOverdue && !isPaid) {
  return 'bg-purple-500/20 border-purple-400 dark:bg-purple-500/30 dark:border-purple-400';
}
```

#### 4. Adicionar linha de juros parcial pago na seção "Só Juros"

Na seção de "Só Juros (por parcela)" (~linhas 7991-8009), adicionar exibição do valor já pago:

```tsx
{/* Interest only payment option */}
{!isDaily && !isPaid && (
  <div className={`mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg text-xs sm:text-sm ${hasSpecialStyle ? 'bg-white/10' : 'bg-purple-500/10 border border-purple-400/30'}`}>
    <div className="flex items-center justify-between">
      <span className={hasSpecialStyle ? 'text-white/80' : 'text-purple-300'}>Só Juros (por parcela):</span>
      <span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-purple-400'}`}>
        {formatCurrency(calculatedInterestPerInstallment)}
      </span>
    </div>
    
    {/* NOVO: Mostrar juros já pago parcialmente */}
    {(() => {
      const partialPaidList = getPartialInterestPaidFromNotes(loan.notes);
      const paidCount = getPaidInstallmentsCount(loan);
      const currentInstallmentIndex = paidCount; // índice da parcela atual
      const paidForCurrent = partialPaidList
        .filter(p => p.installmentIndex === currentInstallmentIndex)
        .reduce((sum, p) => sum + p.amountPaid, 0);
      
      if (paidForCurrent > 0) {
        const remainingInterest = Math.max(0, calculatedInterestPerInstallment - paidForCurrent);
        return (
          <div className="mt-1.5 pt-1.5 border-t border-purple-400/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className={hasSpecialStyle ? 'text-white/80' : 'text-green-300'}>
                💵 Juros já pago:
              </span>
              <span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-green-400'}`}>
                {formatCurrency(paidForCurrent)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={hasSpecialStyle ? 'text-white/80' : 'text-amber-300'}>
                Juros pendente:
              </span>
              <span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-amber-400'}`}>
                {formatCurrency(remainingInterest)}
              </span>
            </div>
          </div>
        );
      }
      return null;
    })()}
    
    {extraInterest > 0 && (
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-purple-400/30">
        <span className={hasSpecialStyle ? 'text-white/80' : 'text-orange-300'}>Juros Extra Adicionado:</span>
        <span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-orange-400'}`}>
          +{formatCurrency(extraInterest)}
        </span>
      </div>
    )}
  </div>
)}
```

---

## Resultado Esperado

Após pagamento parcial de juros (ex: R$ 120 de R$ 200):

| Antes | Depois |
|-------|--------|
| Card com cor normal | Card com fundo **roxo** |
| "Só Juros: R$ 200" | "Só Juros: R$ 200" |
| (nada) | "💵 Juros já pago: R$ 120" (verde) |
| (nada) | "Juros pendente: R$ 80" (amarelo) |

---

## Fluxo Visual

```text
Card do Empréstimo (ROXO quando há juros parcial pago)
┌─────────────────────────────────────────────┐
│  Cliente: devedor 02                        │
│  Pendente  MENSAL                           │
│  R$ 1.200,00                               │
│  restante a receber                         │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Só Juros (por parcela):   R$ 200,00 │   │
│  │ ─────────────────────────────────── │   │
│  │ 💵 Juros já pago:          R$ 120,00│   │
│  │ Juros pendente:            R$ 80,00 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Pagar] [Pagar Juros] [...]               │
└─────────────────────────────────────────────┘
```

---

## Resumo das Alterações

| Local | Alteração |
|-------|-----------|
| ~linha 7297 | Adicionar variável `hasPartialInterestPayments` |
| ~linha 7507 | Incluir `hasPartialInterestPayments` em `hasSpecialStyle` |
| ~linha 7514 | Adicionar caso no `getCardStyle()` para estilo roxo |
| ~linhas 7999-8000 | Adicionar exibição de juros já pago e pendente |
