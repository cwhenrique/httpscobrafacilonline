
# Plano: Correcoes no Pagamento Parcial de Juros

## Problema Identificado

Ao analisar o codigo, identifiquei os seguintes problemas:

1. **Pagamento parcial esta abatendo do saldo devedor**: Os triggers do banco (`update_loan_on_payment` e `recalculate_loan_total_paid`) nao reconhecem a tag `[PARTIAL_INTEREST_PAYMENT]`, entao o pagamento esta sendo tratado como pagamento normal e reduzindo o `remaining_balance`.

2. **Nao mostra pagamentos parciais anteriores**: Quando o usuario reabre a tela de pagamento parcial, nao e exibido quanto ja foi pago anteriormente para aquela parcela.

3. **O total_paid tambem nao deveria somar** (conforme solicitado): O pagamento parcial de juros deve apenas registrar o abatimento do juros daquele mes, sem afetar metricas do contrato.

## Solucao Proposta

### 1. Atualizar Triggers do Banco de Dados

Modificar os dois triggers para reconhecer `[PARTIAL_INTEREST_PAYMENT]` como pagamento que NAO afeta o `remaining_balance`:

**Trigger `update_loan_on_payment`:**
- Adicionar verificacao para `[PARTIAL_INTEREST_PAYMENT]`
- Quando for pagamento parcial de juros, comportar-se como `[INTEREST_ONLY_PAYMENT]` (nao reduz remaining_balance)

**Trigger `recalculate_loan_total_paid`:**
- Adicionar `[PARTIAL_INTEREST_PAYMENT]` na lista de pagamentos excluidos do calculo de `balance_reducing_payments`

### 2. Exibir Pagamentos Parciais Anteriores na UI

Modificar o formulario de pagamento parcial para:
- Extrair pagamentos parciais anteriores usando `getPartialInterestPendingFromNotes()`
- Calcular o total ja pago para a parcela selecionada
- Mostrar resumo: "Juros total", "Ja pago anteriormente", "Valor pago agora", "Juros pendente final"

### 3. Logica de Juros por Periodo

O comportamento correto e:
- Pagamento parcial abate dos juros daquele mes/parcela especifica
- No proximo periodo, os juros sao calculados normalmente sobre o principal (sem considerar pagamentos parciais anteriores)
- A tag `[PARTIAL_INTEREST_PENDING]` rastreia quanto falta quitar dos juros daquela parcela especifica

---

## Secao Tecnica

### Arquivo 1: Migracao SQL para Triggers

Atualizar os dois triggers para reconhecer `[PARTIAL_INTEREST_PAYMENT]`:

```sql
-- Trigger update_loan_on_payment
-- Adicionar verificacao para PARTIAL_INTEREST_PAYMENT junto com INTEREST_ONLY_PAYMENT:

IF NEW.notes LIKE '%[INTEREST_ONLY_PAYMENT]%' OR NEW.notes LIKE '%[PARTIAL_INTEREST_PAYMENT]%' THEN
  -- Nao reduz remaining_balance
  UPDATE public.loans
  SET 
    total_paid = COALESCE(total_paid, 0) + NEW.amount,
    status = CASE 
      WHEN remaining_balance - NEW.amount <= 0 THEN 'paid'::payment_status
      WHEN due_date >= CURRENT_DATE THEN 'pending'::payment_status
      ELSE status
    END
  WHERE id = NEW.loan_id;
...

-- Trigger recalculate_loan_total_paid
-- Adicionar PARTIAL_INTEREST_PAYMENT na exclusao:

SELECT COALESCE(SUM(amount), 0) INTO balance_reducing_payments
FROM public.loan_payments
WHERE loan_id = COALESCE(NEW.loan_id, OLD.loan_id)
  AND (notes NOT LIKE '%[INTEREST_ONLY_PAYMENT]%' OR notes IS NULL)
  AND (notes NOT LIKE '%[PARTIAL_INTEREST_PAYMENT]%' OR notes IS NULL)
  AND (notes NOT LIKE '%[PRE_RENEGOTIATION]%' OR notes IS NULL)
  AND (notes NOT LIKE '%[AMORTIZATION]%' OR notes IS NULL);
```

### Arquivo 2: src/pages/Loans.tsx

#### Modificacao 1: Adicionar Helper para Extrair Pagamentos Parciais JA REALIZADOS

A funcao `getPartialInterestPendingFromNotes` ja existe mas rastreia o que FALTA pagar. Precisamos tambem buscar o historico de pagamentos parciais ja feitos para aquela parcela.

Novo helper (linha ~155):

```typescript
// Helper para extrair pagamentos parciais de juros JA REALIZADOS por parcela
// Formato: [PARTIAL_INTEREST_PAID:indice:valor:data]
const getPartialInterestPaidFromNotes = (notes: string | null): Array<{
  installmentIndex: number;
  amountPaid: number;
  paymentDate: string;
}> => {
  const paid: Array<{ installmentIndex: number; amountPaid: number; paymentDate: string }> = [];
  const matches = (notes || '').matchAll(/\[PARTIAL_INTEREST_PAID:(\d+):([0-9.]+):([^\]]+)\]/g);
  for (const match of matches) {
    paid.push({
      installmentIndex: parseInt(match[1]),
      amountPaid: parseFloat(match[2]),
      paymentDate: match[3]
    });
  }
  return paid;
};
```

#### Modificacao 2: Atualizar Logica de Submit (~linha 4700)

Ao registrar pagamento parcial:
1. Adicionar tag `[PARTIAL_INTEREST_PAID:indice:valor:data]` para rastrear o que foi pago
2. Atualizar ou adicionar tag `[PARTIAL_INTEREST_PENDING:indice:valor:data]` com o valor que falta
3. Se o valor pendente for zero, remover a tag PENDING

```typescript
// Atualizar notas com AMBAS as tags
let notesText = loan.notes || '';

// Registrar o que foi pago
notesText += `\n[PARTIAL_INTEREST_PAID:${installmentIndex}:${partialAmount.toFixed(2)}:${paymentDate}]`;

// Atualizar ou adicionar tag de pendente
if (pendingInterest > 0.01) {
  notesText += `\n[PARTIAL_INTEREST_PENDING:${installmentIndex}:${pendingInterest.toFixed(2)}:${paymentDate}]`;
}
notesText += `\nPagamento parcial de juros: R$ ${partialAmount.toFixed(2)} em ${formatDate(paymentDate)} (Parcela ${installmentIndex + 1})`;
```

#### Modificacao 3: Atualizar UI do Formulario (~linha 12262)

Mostrar pagamentos anteriores quando usuario seleciona uma parcela:

```tsx
{activeOption === 'partial_interest' && (() => {
  const selectedIndex = parseInt(renegotiateData.partial_interest_installment);
  
  // Buscar pagamentos parciais anteriores desta parcela
  const partialPaidList = getPartialInterestPaidFromNotes(selectedLoan.notes);
  const previousPaymentsForInstallment = partialPaidList
    .filter(p => p.installmentIndex === selectedIndex);
  const totalPreviouslyPaid = previousPaymentsForInstallment
    .reduce((sum, p) => sum + p.amountPaid, 0);
  
  // Juros total menos o que ja foi pago
  const remainingInterestForInstallment = Math.max(0, interestPerInstallment - totalPreviouslyPaid);
  
  return (
    <div className="space-y-4 border-2 border-cyan-500 rounded-lg p-4 bg-cyan-950/50">
      {/* ... header existente ... */}
      
      {/* Mostrar pagamentos anteriores se existirem */}
      {totalPreviouslyPaid > 0 && (
        <div className="bg-amber-500/20 rounded-lg p-3 border border-amber-500/50">
          <p className="text-amber-300 text-sm font-medium">Pagamentos anteriores desta parcela:</p>
          {previousPaymentsForInstallment.map((p, i) => (
            <p key={i} className="text-amber-200 text-xs">
              R$ {formatCurrency(p.amountPaid)} em {formatDate(p.paymentDate)}
            </p>
          ))}
          <p className="text-amber-400 font-bold mt-1">
            Total ja pago: {formatCurrency(totalPreviouslyPaid)}
          </p>
        </div>
      )}
      
      {/* Resumo atualizado */}
      <div className="bg-cyan-500/20 rounded-lg p-4 space-y-2 border border-cyan-500">
        <div className="flex justify-between items-center">
          <span className="text-cyan-300 text-sm">Juros total da parcela:</span>
          <span className="font-bold text-white">{formatCurrency(interestPerInstallment)}</span>
        </div>
        {totalPreviouslyPaid > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-cyan-300 text-sm">Ja pago anteriormente:</span>
            <span className="font-bold text-amber-400">{formatCurrency(totalPreviouslyPaid)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-cyan-300 text-sm">Valor pago agora:</span>
          <span className="font-bold text-green-400">{formatCurrency(parseFloat(renegotiateData.partial_interest_amount) || 0)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-cyan-500/50 pt-2">
          <span className="text-cyan-400 font-medium">Juros pendente final:</span>
          <span className="text-xl font-bold text-amber-400">
            {formatCurrency(Math.max(0, remainingInterestForInstallment - (parseFloat(renegotiateData.partial_interest_amount) || 0)))}
          </span>
        </div>
      </div>
    </div>
  );
})()}
```

#### Modificacao 4: Pre-carregar Valor Pendente ao Selecionar Parcela

Quando usuario troca de parcela, calcular automaticamente quanto ainda falta:

```typescript
// No onValueChange do Select de parcela:
onValueChange={(v) => {
  const idx = parseInt(v);
  const partialPaidList = getPartialInterestPaidFromNotes(selectedLoan.notes);
  const totalPaidForThis = partialPaidList
    .filter(p => p.installmentIndex === idx)
    .reduce((sum, p) => sum + p.amountPaid, 0);
  const remaining = Math.max(0, interestPerInstallment - totalPaidForThis);
  
  setRenegotiateData({ 
    ...renegotiateData, 
    partial_interest_installment: v,
    // Pre-preencher com o que falta (opcional)
    partial_interest_amount: remaining > 0 ? remaining.toFixed(2) : ''
  });
}}
```

### Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Atualizar 2 triggers para reconhecer `[PARTIAL_INTEREST_PAYMENT]` |
| src/pages/Loans.tsx | Adicionar helper `getPartialInterestPaidFromNotes` |
| src/pages/Loans.tsx | Atualizar logica de submit para gravar tag `[PARTIAL_INTEREST_PAID]` |
| src/pages/Loans.tsx | Atualizar UI para mostrar pagamentos anteriores |
| src/pages/Loans.tsx | Pre-carregar valor pendente ao selecionar parcela |

### Fluxo Completo

```text
Usuario abre "Pagamento parcial de juros"
         |
         v
Seleciona parcela (ex: Parcela 1)
         |
         v
Sistema busca pagamentos anteriores desta parcela
  - [PARTIAL_INTEREST_PAID:0:300:2026-01-07] = R$ 300 ja pago
         |
         v
Exibe: "Juros total: R$ 1000 | Ja pago: R$ 300 | Falta: R$ 700"
         |
         v
Usuario digita valor: R$ 200
         |
         v
Sistema calcula: Pendente = 700 - 200 = R$ 500
         |
         v
Ao submeter:
  - Registra loan_payment (NAO afeta remaining_balance)
  - Adiciona [PARTIAL_INTEREST_PAID:0:200:2026-01-10]
  - Adiciona [PARTIAL_INTEREST_PENDING:0:500:2026-01-10]
         |
         v
Proximo mes (Parcela 2):
  - Juros calculado normalmente (ex: R$ 1000)
  - Nenhum abatimento de pagamentos da Parcela 1
```
