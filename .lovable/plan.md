
# Exibir Botoes de Cobranca WhatsApp Direto no Card de Contrato

## Problema Identificado

Atualmente, os botoes de cobranca via WhatsApp para contratos so aparecem quando o usuario expande a secao de parcelas. O usuario precisa clicar em "Parcelas" para ver e usar os botoes de cobranca. Isso e diferente do comportamento nos emprestimos, onde os botoes ficam visiveis diretamente no card.

## Solucao Proposta

Adicionar os botoes de cobranca WhatsApp diretamente no card do contrato, sem precisar expandir as parcelas. Os botoes serao exibidos com base no status da proxima parcela pendente:

- **Parcela em Atraso**: Botao "Enviar Cobranca" vermelho
- **Vence Hoje**: Botao "Cobrar Hoje" amarelo  
- **Pendente (futura)**: Botao "Cobrar Antes do Prazo" outline

## Layout Visual Proposto

```text
+------------------------------------------+
| [icone] Cliente: Joao Silva              |
|         Tipo: Aluguel                    |
|------------------------------------------|
| Valor mensal: R$ 1.000   Total: R$ 12.000|
|------------------------------------------|
| [!] Parcela 2/12 - 10 dias em atraso     |
| [Enviar Cobranca WhatsApp]               |   <-- NOVO
|------------------------------------------|
| [Parcelas]  [Editar]  [Excluir]          |
+------------------------------------------+
```

## Alteracoes Necessarias

### Arquivo: src/pages/ProductSales.tsx

**1. Adicionar logica para determinar status do contrato (antes do render)**

Criar funcao `getContractNextPaymentStatus` que recebe o contrato e seus pagamentos e retorna:
- Qual a proxima parcela pendente
- Se esta em atraso, vence hoje ou e futura
- Quantos dias de atraso ou ate o vencimento

**2. Adicionar secao de status e cobranca no card do contrato**

Entre as informacoes do contrato (linhas 1717-1726) e os botoes de acao (linhas 1727-1734), adicionar:

```text
Logica:
1. Verificar se contrato tem client_phone
2. Buscar pagamentos do contrato em contractPayments ou allContractPayments
3. Encontrar primeira parcela nao paga
4. Determinar status: overdue, due_today ou pending
5. Mostrar badge de status + botao de cobranca apropriado
```

**3. Estrutura JSX a adicionar (~apos linha 1726)**

```jsx
{/* Status e botao de cobranca WhatsApp direto no card */}
{contract.status !== 'paid' && contract.client_phone && (() => {
  const payments = contractPayments[contract.id] || allContractPayments.filter(p => p.contract_id === contract.id);
  const nextPendingPayment = payments
    .filter(p => p.status !== 'paid')
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime())[0];
  
  if (!nextPendingPayment) return null;
  
  const paymentDate = parseISO(nextPendingPayment.due_date);
  const isOverdue = isPast(paymentDate) && !isToday(paymentDate);
  const isDueToday = isToday(paymentDate);
  const isPending = !isPast(paymentDate);
  const daysOverdue = isOverdue ? Math.floor((Date.now() - paymentDate.getTime()) / 86400000) : 0;
  const daysUntilDue = isPending ? Math.max(1, Math.floor((paymentDate.getTime() - Date.now()) / 86400000)) : 0;
  const paidCount = payments.filter(p => p.status === 'paid').length;
  
  return (
    <div className="mb-3 space-y-2">
      {/* Badge de status */}
      <div className={cn(
        "p-2 rounded-lg text-sm flex items-center justify-between",
        isOverdue && "bg-destructive/10",
        isDueToday && "bg-yellow-500/10",
        isPending && "bg-muted"
      )}>
        <div className="flex items-center gap-2">
          {isOverdue && <AlertTriangle className="w-4 h-4 text-destructive" />}
          {isDueToday && <Clock className="w-4 h-4 text-yellow-600" />}
          {isPending && <Calendar className="w-4 h-4 text-muted-foreground" />}
          <span>
            {nextPendingPayment.installment_number}a parcela - {format(paymentDate, "dd/MM")}
            {isOverdue && <span className="text-destructive font-medium ml-1">({daysOverdue}d atraso)</span>}
            {isDueToday && <span className="text-yellow-600 font-medium ml-1">(Vence Hoje)</span>}
          </span>
        </div>
        <span className="font-semibold">{formatCurrency(nextPendingPayment.amount)}</span>
      </div>
      
      {/* Botao de cobranca WhatsApp */}
      {isOverdue && (
        <SendOverdueNotification data={{...}} className="w-full" />
      )}
      {isDueToday && (
        <SendDueTodayNotification data={{...}} className="w-full" />
      )}
      {isPending && (
        <SendEarlyNotification data={{...}} className="w-full" />
      )}
    </div>
  );
})()}
```

## Secao Tecnica

### Localizacao exata das mudancas

**Arquivo:** `src/pages/ProductSales.tsx`

**Linha de insercao:** Entre linhas 1726 e 1727 (apos o bloco `<div className="space-y-2 mb-3">` com valores do contrato e antes do `<div className="flex gap-2">` com botoes de acao)

### Dados necessarios para os componentes de notificacao

Para `SendOverdueNotification`:
```typescript
{
  clientName: contract.client_name,
  clientPhone: contract.client_phone,
  contractType: 'contract',
  installmentNumber: nextPendingPayment.installment_number,
  totalInstallments: contract.installments,
  amount: nextPendingPayment.amount,
  dueDate: nextPendingPayment.due_date,
  daysOverdue: daysOverdue,
  loanId: contract.id,
  paidCount: paidCount,
}
```

Para `SendDueTodayNotification`:
```typescript
{
  clientName: contract.client_name,
  clientPhone: contract.client_phone,
  contractType: 'contract',
  installmentNumber: nextPendingPayment.installment_number,
  totalInstallments: contract.installments,
  amount: nextPendingPayment.amount,
  dueDate: nextPendingPayment.due_date,
  loanId: contract.id,
  paidCount: paidCount,
}
```

Para `SendEarlyNotification`:
```typescript
{
  clientName: contract.client_name,
  clientPhone: contract.client_phone,
  contractType: 'contract',
  installmentNumber: nextPendingPayment.installment_number,
  totalInstallments: contract.installments,
  amount: nextPendingPayment.amount,
  dueDate: nextPendingPayment.due_date,
  daysUntilDue: daysUntilDue,
  loanId: contract.id,
  paidCount: paidCount,
}
```

### Uso de allContractPayments

O hook `useContracts` ja expoe `allContractPayments` que contem todos os pagamentos. Isso permite mostrar o status sem precisar expandir cada contrato primeiro (que carrega os pagamentos via `contractPayments[contract.id]`).

## Beneficios

1. Usuario ve imediatamente o status de cobranca de cada contrato
2. Nao precisa expandir parcelas para enviar cobranca
3. Consistencia com o comportamento da pagina de Emprestimos
4. Acesso mais rapido as acoes de cobranca frequentes
