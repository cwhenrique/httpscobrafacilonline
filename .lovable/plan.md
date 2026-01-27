

# Corrigir Cálculo de "Juros a Receber" para Pagamentos Interest-Only

## Diagnóstico

O empréstimo de R$ 10.000 teve um pagamento de **apenas juros** (R$ 2.000), marcado com a tag `[INTEREST_ONLY_PAYMENT]`. O cliente ainda deve:
- **Principal**: R$ 10.000
- **Juros futuros**: R$ 2.000 (quando a parcela vencer em 27/03)

O código atual calcula parcelas pagas assim:
```typescript
const paidInstallmentsCount = Math.floor(interestPaid / interestPerInstallment)
// = Math.floor(2000 / 2000) = 1 parcela "paga"
```

Isso faz o sistema pensar que a parcela foi quitada, quando na verdade apenas os juros foram pagos antecipadamente.

## Solução

Mudar a lógica para considerar uma parcela como "paga" apenas quando **AMBOS** principal e juros foram pagos. Uma parcela com juros pagos mas principal pendente ainda deve contar os juros futuros a receber.

## Alterações Necessárias

### Arquivo: `src/pages/ReportsLoans.tsx`

**Linhas 503-515** - Modificar lógica de contagem de parcelas pagas:

```typescript
// If period is selected and loan has installment dates, filter by due dates
if (dateRange?.from && dateRange?.to && installmentDates.length > 0) {
  const startDate = startOfDay(dateRange.from);
  const endDate = endOfDay(dateRange.to);
  
  // Get principal paid to determine truly paid installments
  const principalPaid = payments.reduce((s: number, p: any) => 
    s + Number(p.principal_paid || 0), 0);
  
  const principalPerInstallment = principal / installments;
  
  // An installment is only "fully paid" when both principal AND interest are paid
  // For interest-only payments, the installment is NOT fully paid
  const fullyPaidInstallments = principalPerInstallment > 0 
    ? Math.min(Math.floor(principalPaid / principalPerInstallment), installments)
    : 0;
  
  let interestInPeriod = 0;
  installmentDates.forEach((dateStr: string, index: number) => {
    const dueDate = parseISO(dateStr);
    // Include interest for installments that are NOT fully paid and within period
    if (index >= fullyPaidInstallments && isWithinInterval(dueDate, { start: startDate, end: endDate })) {
      // For this installment, calculate remaining interest
      // If some interest was already paid but installment not fully paid,
      // the remaining interest for this installment might be 0 or reduced
      const installmentInterestPaid = index < fullyPaidInstallments + 1 
        ? Math.max(0, interestPaid - (fullyPaidInstallments * interestPerInstallment))
        : 0;
      
      const remainingInterestForInstallment = interestPerInstallment - installmentInterestPaid;
      interestInPeriod += Math.max(0, remainingInterestForInstallment);
    }
  });
  
  return sum + Math.max(0, interestInPeriod);
}
```

## Lógica Explicada

| Situação | Parcela Quitada? | Juros a Receber |
|----------|------------------|-----------------|
| Principal pago + Juros pagos | Sim | R$ 0 |
| Principal pago + Juros não pagos | Não* | Juros pendentes |
| Principal não pago + Juros pagos | Não | R$ 0 (juros já recebidos) |
| Principal não pago + Juros não pagos | Não | Juros da parcela |

*Caso raro, mas possível

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Juros a Receber (jan-mai) | R$ 0,00 | R$ 0,00 |
| Falta Receber | R$ 12.000 | R$ 12.000 |

**Nota importante**: Neste caso específico, o cliente já pagou os R$ 2.000 de juros da única parcela. Os "Juros a Receber" devem mostrar R$ 0 porque:
- O empréstimo tem 1 parcela de R$ 12.000 (R$ 10k principal + R$ 2k juros)
- Os juros dessa parcela (R$ 2.000) já foram pagos
- O que resta são R$ 10.000 de **principal**, não de juros

Se o contrato gerasse **novos juros** sobre o principal pendente (juros compostos), aí sim haveria mais juros a receber. Mas como é juros simples "per_installment", os R$ 2.000 de juros já foram recebidos.

## Interpretação do Cenário

Talvez a confusão seja sobre o que significa "Juros a Receber":

- **Juros a Receber**: Juros contratuais ainda não pagos
- **Falta Receber**: Total restante (principal + juros pendentes)

No seu caso:
- Juros contratuais: R$ 2.000 → **Já pagos** ✓
- Principal: R$ 10.000 → **Pendente**
- Falta Receber: R$ 12.000 (remaining_balance que inclui o principal + estrutura do sistema)

O remaining_balance de R$ 12.000 parece incorreto - deveria ser R$ 10.000 após o pagamento de juros. Isso pode ser um bug no trigger de atualização.

## Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `src/pages/ReportsLoans.tsx` | Usar `principal_paid` para determinar parcelas quitadas |

