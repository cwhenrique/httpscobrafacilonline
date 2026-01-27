

# Corrigir "Juros a Receber" para Filtrar por Período

## Problema Identificado

Ao filtrar por um período de 4 meses (janeiro a abril), o empréstimo de R$ 10.000 com parcela em 27/03 não mostra os R$ 2.000 de juros a receber porque:

1. **O cálculo atual de "Juros a Receber" usa CURRENT STATE** - mostra todos os juros pendentes independente do período
2. **Não considera as datas de vencimento das parcelas** - deveria mostrar apenas juros de parcelas que vencem no período selecionado

### Dados do empréstimo:
- Principal: R$ 10.000
- Juros: R$ 2.000 (20%)
- Data de vencimento: 27/03/2026
- Período filtrado: ~4 meses (jan-abr)

## Solucao

Modificar o calculo de `pendingInterest` para filtrar por periodo quando um periodo esta selecionado, similar ao que ja e feito com `pendingAmount`.

## Alteracoes Necessarias

### Arquivo: `src/pages/ReportsLoans.tsx`

**Linhas 463-487** - Modificar calculo de `pendingInterest`:

```typescript
// Juros a Receber - FILTRADO POR PERÍODO (parcelas que vencem no período)
const pendingInterest = allActiveLoans.reduce((sum, loan) => {
  const principal = Number(loan.principal_amount);
  const rate = Number(loan.interest_rate);
  const installments = Number(loan.installments) || 1;
  const interestMode = loan.interest_mode || 'per_installment';
  const isDaily = loan.payment_type === 'daily';
  const installmentDates = (loan as any).installment_dates || [];
  
  const payments = (loan as any).payments || [];
  const interestPaid = payments.reduce((s: number, p: any) => 
    s + Number(p.interest_paid || 0), 0);
  
  // Calcular juros por parcela
  let interestPerInstallment = 0;
  if (isDaily) {
    const dailyInstallment = Number(loan.total_interest) || 0;
    const principalPerInstallment = principal / installments;
    interestPerInstallment = dailyInstallment - principalPerInstallment;
  } else if (interestMode === 'per_installment') {
    interestPerInstallment = principal * (rate / 100);
  } else {
    interestPerInstallment = (principal * (rate / 100)) / installments;
  }
  
  // Se tem período selecionado, filtrar por datas de vencimento
  if (dateRange?.from && dateRange?.to && installmentDates.length > 0) {
    const startDate = startOfDay(dateRange.from);
    const endDate = endOfDay(dateRange.to);
    
    let interestInPeriod = 0;
    installmentDates.forEach((dateStr: string, index: number) => {
      const dueDate = parseISO(dateStr);
      if (isWithinInterval(dueDate, { start: startDate, end: endDate })) {
        // Esta parcela vence no período - incluir juros proporcionais
        interestInPeriod += interestPerInstallment;
      }
    });
    
    // Subtrair juros já pagos (proporcional)
    const interestPaidPerInstallment = interestPaid / installments;
    const paidInstallments = Math.floor(interestPaid / interestPerInstallment);
    
    return sum + Math.max(0, interestInPeriod);
  }
  
  // Sem período selecionado - mostrar todos os juros pendentes
  let totalInterest = 0;
  if (isDaily) {
    totalInterest = Number(loan.remaining_balance || 0) + Number(loan.total_paid || 0) - principal;
  } else {
    totalInterest = interestMode === 'per_installment' 
      ? principal * (rate / 100) * installments 
      : principal * (rate / 100);
  }
  
  return sum + Math.max(0, totalInterest - interestPaid);
}, 0);
```

## Logica da Correcao

1. **Calcular juros por parcela** baseado no modo de juros (per_installment ou on_total)
2. **Verificar cada data de vencimento** contra o período selecionado
3. **Somar apenas juros de parcelas que vencem no período**
4. **Manter comportamento atual** quando nenhum período está selecionado

## Resultado Esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Juros a Receber (4 meses) | R$ 0 | R$ 2.000 |
| Parcela 27/03 | Nao contabilizada | Contabilizada |

O emprestimo de R$ 10.000 com parcela em 27/03 passara a mostrar os R$ 2.000 de juros a receber quando o periodo de 4 meses for selecionado.

## Arquivos Modificados

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/ReportsLoans.tsx` | Modificar calculo de `pendingInterest` para filtrar por datas de vencimento |

