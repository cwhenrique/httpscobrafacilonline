
# Plano: Exportação CSV Completa de Empréstimos com Multas e Juros em Atraso

## Situação Atual

A exportação CSV em `src/components/LoansTableView.tsx` inclui apenas campos básicos:
- Cliente, Telefone, Status
- Valor Emprestado, Total a Receber, Valor Restante
- Parcelas Pagas/Total, Próximo Vencimento
- Taxa de Juros, Tipo de Pagamento, Data de Início
- Notas

**Informações AUSENTES:**
- Multas aplicadas (manuais)
- Juros por atraso (dinâmicos)
- Dias em atraso
- Valor da parcela
- Total pago
- Lucro (juros totais)
- CPF/RG do cliente
- Endereço do cliente

## Novos Campos a Adicionar

| Campo | Descrição |
|-------|-----------|
| CPF | Documento do cliente |
| E-mail | Email do cliente |
| Endereço | Endereço completo |
| Dias em Atraso | Quantidade de dias em atraso |
| Multas Manuais | Total de multas aplicadas manualmente |
| Juros por Atraso | Juros dinâmicos calculados pelo atraso |
| Total + Multas | Valor total incluindo multas e juros atraso |
| Valor da Parcela | Valor unitário de cada parcela |
| Total Pago | Quanto já foi pago |
| Lucro Previsto | Total de juros do contrato |
| Data do Contrato | Data de criação do contrato |
| Modo de Juros | on_total, per_installment, compound |

## Alterações Técnicas

### Arquivo: `src/components/LoansTableView.tsx`

**1. Adicionar imports das funções de cálculo:**
```typescript
import { 
  formatCurrency, 
  formatDate, 
  getTotalDailyPenalties, 
  getDaysOverdue, 
  calculateDynamicOverdueInterest,
  calculateInstallmentValue,
  isLoanOverdue
} from '@/lib/calculations';
```

**2. Expandir os headers do CSV:**
```typescript
const headers = [
  'Cliente',
  'Telefone',
  'CPF',
  'E-mail',
  'Endereço',
  'Status',
  'Valor Emprestado',
  'Taxa de Juros (%)',
  'Modo de Juros',
  'Lucro Previsto',
  'Total a Receber',
  'Valor da Parcela',
  'Parcelas Pagas',
  'Total Parcelas',
  'Total Pago',
  'Valor Restante',
  'Dias em Atraso',
  'Multas Manuais',
  'Juros por Atraso',
  'Total + Multas',
  'Próximo Vencimento',
  'Tipo de Pagamento',
  'Data do Contrato',
  'Data de Início',
  'Notas'
];
```

**3. Calcular os novos valores para cada empréstimo:**
```typescript
const rows = sortedLoans.map(loan => {
  const status = getLoanStatus(loan);
  const paidCount = getPaidInstallmentsCount(loan);
  const nextDue = getNextDueDate(loan);
  
  // Juros totais
  const totalInterest = loan.total_interest || (loan.principal_amount * loan.interest_rate / 100);
  const totalToReceive = loan.principal_amount + totalInterest;
  
  // Multas e atrasos
  const manualPenalties = getTotalDailyPenalties(loan.notes);
  const daysOverdue = isLoanOverdue(loan) ? getDaysOverdue(loan) : 0;
  const dynamicInterest = calculateDynamicOverdueInterest(loan, daysOverdue);
  const totalWithPenalties = loan.remaining_balance + manualPenalties + dynamicInterest;
  
  // Valor da parcela
  const installmentValue = calculateInstallmentValue(loan);
  
  // Modo de juros legível
  const interestModeLabel = {
    'on_total': 'Sobre o Total',
    'per_installment': 'Por Parcela',
    'compound': 'Composto (Price)'
  }[loan.interest_mode || 'on_total'] || loan.interest_mode;
  
  // Endereço completo
  const address = [
    loan.client?.street,
    loan.client?.number,
    loan.client?.complement,
    loan.client?.neighborhood,
    loan.client?.city,
    loan.client?.state
  ].filter(Boolean).join(', ') || loan.client?.address || 'N/A';

  return [
    loan.client?.full_name || 'N/A',
    loan.client?.phone || 'N/A',
    loan.client?.cpf || 'N/A',
    loan.client?.email || 'N/A',
    address,
    status.label,
    loan.principal_amount.toFixed(2).replace('.', ','),
    loan.interest_rate.toString().replace('.', ','),
    interestModeLabel,
    totalInterest.toFixed(2).replace('.', ','),
    totalToReceive.toFixed(2).replace('.', ','),
    installmentValue.toFixed(2).replace('.', ','),
    paidCount.toString(),
    (loan.installments || 1).toString(),
    (loan.total_paid || 0).toFixed(2).replace('.', ','),
    loan.remaining_balance.toFixed(2).replace('.', ','),
    daysOverdue.toString(),
    manualPenalties.toFixed(2).replace('.', ','),
    dynamicInterest.toFixed(2).replace('.', ','),
    totalWithPenalties.toFixed(2).replace('.', ','),
    nextDue ? formatDate(nextDue) : 'N/A',
    getPaymentTypeLabel(loan.payment_type),
    loan.contract_date ? formatDate(loan.contract_date) : formatDate(loan.start_date),
    loan.start_date ? formatDate(loan.start_date) : 'N/A',
    (loan.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')
  ];
});
```

## Resultado Final do CSV

O arquivo CSV exportado terá 25 colunas com todas as informações relevantes:

```text
Cliente;Telefone;CPF;E-mail;Endereço;Status;Valor Emprestado;Taxa de Juros (%);Modo de Juros;Lucro Previsto;Total a Receber;Valor da Parcela;Parcelas Pagas;Total Parcelas;Total Pago;Valor Restante;Dias em Atraso;Multas Manuais;Juros por Atraso;Total + Multas;Próximo Vencimento;Tipo de Pagamento;Data do Contrato;Data de Início;Notas
```

## Arquivo a Modificar

- `src/components/LoansTableView.tsx` - Expandir função `handleExportCSV`
