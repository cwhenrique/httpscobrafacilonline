
# Plano: Correções no Pagamento Parcial de Juros

## Problemas Identificados

Analisando o código, encontrei os seguintes problemas:

1. **Dados não atualizam após pagamento parcial**: Após registrar o pagamento parcial, o código atualiza as notas diretamente no banco mas **não chama `invalidateLoans()`**, então ao reabrir o diálogo, os dados antigos ainda estão em memória.

2. **Não rola o contrato quando juros são completamente quitados**: Quando o usuário paga os R$ 130 restantes (completando os R$ 200), o sistema deveria automaticamente "rolar" o contrato para o próximo mês, igual ao "Cliente pagou só os juros".

3. **Falta exibição do breakdown na visualização da parcela**: Na lista de parcelas, deveria mostrar separadamente quanto de juros já foi pago parcialmente e quanto ainda falta.

## Solução Proposta

### Correção 1: Chamar invalidateLoans() após pagamento parcial

Adicionar chamada a `invalidateLoans()` após o update das notas para forçar recarga dos dados.

### Correção 2: Detectar quando juros foram completamente quitados

Quando `pendingInterest <= 0.01`:
- Rolar as datas do contrato para o próximo período (semana/quinzena/mês)
- Comportar-se igual ao "Cliente pagou só os juros"
- Limpar as tags de pagamento parcial daquela parcela específica

### Correção 3: Exibir breakdown de juros na visualização

No card de parcelas do empréstimo, quando houver pagamentos parciais de juros:
- Mostrar badge com "Juros já pago: R$ 70"
- Mostrar "Juros pendente: R$ 130"
- Manter exibição do principal a receber

---

## Seção Técnica

### Arquivo: src/pages/Loans.tsx

#### Alteração 1: Adicionar invalidateLoans após pagamento parcial (~linha 4759)

```typescript
// Após o update das notes, invalidar para recarregar dados
await supabase.from('loans').update({
  notes: notesText,
  updated_at: new Date().toISOString()
}).eq('id', selectedLoanId);

// ADICIONAR: Forçar recarga dos dados
invalidateLoans();
```

#### Alteração 2: Detectar quitação completa dos juros e rolar contrato (~linha 4724)

Modificar a lógica para detectar quando os juros da parcela foram completamente quitados:

```typescript
// Após calcular pendingInterest
const pendingInterest = Math.max(0, remainingInterestBeforePayment - partialAmount);

// SE JUROS COMPLETAMENTE QUITADOS: Rolar contrato igual ao "pagou só os juros"
if (pendingInterest <= 0.01) {
  // Lógica para rolar datas igual ao "Cliente pagou só os juros"
  const rollDateForward = (date: Date, paymentType: string): Date => {
    if (paymentType === 'weekly') {
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    } else if (paymentType === 'biweekly') {
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() + 15);
      return newDate;
    } else {
      return addMonths(date, 1);
    }
  };
  
  // Calcular novas datas
  const currentDates = (loan.installment_dates as string[]) || [];
  const newDates = currentDates.map(d => format(rollDateForward(new Date(d + 'T12:00:00'), loan.payment_type), 'yyyy-MM-dd'));
  const newDueDate = newDates[newDates.length - 1] || format(rollDateForward(new Date(loan.due_date + 'T12:00:00'), loan.payment_type), 'yyyy-MM-dd');
  
  // Limpar tags PARTIAL_INTEREST_PAID e PARTIAL_INTEREST_PENDING da parcela quitada
  notesText = notesText.replace(new RegExp(`\\[PARTIAL_INTEREST_PAID:${installmentIndex}:[^\\]]+\\]\\n?`, 'g'), '');
  notesText = notesText.replace(new RegExp(`\\[PARTIAL_INTEREST_PENDING:${installmentIndex}:[^\\]]+\\]\\n?`, 'g'), '');
  notesText += `\n[INTEREST_CLEARED:${installmentIndex}:${paymentDate}] Juros da parcela ${installmentIndex + 1} quitado via pagamentos parciais`;
  
  // Atualizar empréstimo com novas datas E notas
  await supabase.from('loans').update({
    notes: notesText,
    installment_dates: newDates,
    due_date: newDueDate,
    updated_at: new Date().toISOString()
  }).eq('id', selectedLoanId);
  
  toast.success(`Juros da parcela ${installmentIndex + 1} totalmente quitado! Contrato rolado para próximo período.`);
} else {
  // Apenas atualizar notes (comportamento atual)
  await supabase.from('loans').update({
    notes: notesText,
    updated_at: new Date().toISOString()
  }).eq('id', selectedLoanId);
  
  toast.success(`Pagamento parcial de ${formatCurrency(partialAmount)} registrado. Juros pendente: ${formatCurrency(pendingInterest)}`);
}
```

#### Alteração 3: Exibir breakdown de juros nos cards de parcela

Localizar onde os cards de parcelas são renderizados e adicionar exibição dos pagamentos parciais de juros:

```tsx
{/* Dentro do card de cada parcela */}
{(() => {
  const partialPaidList = getPartialInterestPaidFromNotes(loan.notes);
  const paidForThisInstallment = partialPaidList
    .filter(p => p.installmentIndex === installmentIndex)
    .reduce((sum, p) => sum + p.amountPaid, 0);
  const interestPerInst = (loan.total_interest || 0) / (loan.installments || 1);
  const pendingInterestForThis = Math.max(0, interestPerInst - paidForThisInstallment);
  
  if (paidForThisInstallment > 0) {
    return (
      <div className="text-xs mt-1 space-y-0.5">
        <p className="text-green-400">Juros já pago: {formatCurrency(paidForThisInstallment)}</p>
        {pendingInterestForThis > 0 && (
          <p className="text-amber-400">Juros pendente: {formatCurrency(pendingInterestForThis)}</p>
        )}
      </div>
    );
  }
  return null;
})()}
```

### Fluxo Corrigido

```text
Usuário paga R$ 70 de juros da Parcela 1 (juros total: R$ 200)
         |
         v
Sistema registra:
  - loan_payment com amount=70, notes=[PARTIAL_INTEREST_PAYMENT]
  - [PARTIAL_INTEREST_PAID:0:70:2026-01-07]
  - [PARTIAL_INTEREST_PENDING:0:130:2026-01-07]
  - CHAMA invalidateLoans() para recarregar dados
         |
         v
Usuário reabre tela de pagamento parcial
         |
         v
Sistema exibe corretamente:
  - "Juros total: R$ 200"
  - "Já pago anteriormente: R$ 70"
  - "Falta: R$ 130"
         |
         v
Usuário paga os R$ 130 restantes
         |
         v
Sistema detecta: pendingInterest = 0
         |
         v
Sistema ROLA O CONTRATO:
  - Nova data de vencimento = +1 mês
  - Limpa tags de pagamento parcial da parcela 1
  - Toast: "Juros da parcela 1 quitado! Contrato rolado."
         |
         v
Próximo mês (Parcela 2):
  - Juros volta ao normal: R$ 200
  - Ciclo recomeça
```

### Resumo das Alterações

| Local | Alteração |
|-------|-----------|
| ~linha 4759 | Adicionar `invalidateLoans()` após update |
| ~linha 4724-4765 | Lógica para detectar quitação completa e rolar contrato |
| Cards de parcela | Exibir breakdown de juros pagos/pendentes |

### Validações Adicionais

1. Se valor pago > juros pendente, avisar usuário e usar o valor exato do pendente
2. Ao rolar contrato, recalcular corretamente as datas baseado no tipo (semanal/quinzenal/mensal)
3. Preservar histórico de pagamentos parciais nas notas para auditoria
