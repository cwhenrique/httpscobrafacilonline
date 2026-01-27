

# Adicionar Cobranca WhatsApp para Contratos e Produtos

## Resumo do Problema

A area de Contratos e Produtos nao possui os botoes de cobranca via WhatsApp que existem na pagina de Emprestimos:
- **Contratos**: Nao tem nenhum botao de cobranca (nem atraso, nem vence hoje, nem antecipada)
- **Produtos**: Tem cobranca de atraso e vence hoje, mas falta cobranca antecipada

## Solucao

Adicionar os mesmos botoes de notificacao WhatsApp que existem nos emprestimos:

1. **Cobranca de Atraso** (`SendOverdueNotification`) - Quando parcela esta atrasada
2. **Cobranca de Hoje** (`SendDueTodayNotification`) - Quando parcela vence hoje
3. **Cobranca Antecipada** (`SendEarlyNotification`) - Quando parcela ainda nao venceu

## Alteracoes Necessarias

### 1. Contratos (ProductSales.tsx - Tab Contracts)

Localizado nas linhas ~1686-1825

**Adicionar para cada contrato com parcelas:**

- Quando tem parcela em ATRASO: mostrar botao "Enviar Cobranca" vermelho
- Quando tem parcela que VENCE HOJE: mostrar botao "Cobrar Parcela de Hoje" amarelo
- Quando tem parcela PENDENTE (futura): mostrar botao "Cobrar Antes do Prazo" outline

**Mudancas visuais no card de contrato:**
- Adicionar indicador visual de status (icone de alerta para atraso, relogio para vence hoje)
- Mostrar dias de atraso quando aplicavel
- Exibir botoes de cobranca dentro da secao de parcelas expandida

### 2. Produtos (ProductSaleCard.tsx)

Localizado nas linhas 240-281

**Adicionar cobranca antecipada:**

- Quando status e 'pending' (proxima parcela no futuro): mostrar botao "Cobrar Antes do Prazo"
- Posicionar abaixo das informacoes da proxima parcela

## Implementacao Tecnica

### Arquivo 1: src/pages/ProductSales.tsx

**Importar componentes:**
```typescript
import SendOverdueNotification from '@/components/SendOverdueNotification';
import SendDueTodayNotification from '@/components/SendDueTodayNotification';
import { SendEarlyNotification } from '@/components/SendEarlyNotification';
```

**Adicionar logica para determinar status do contrato:**
```typescript
const getContractStatus = (contract: Contract, payments: ContractPayment[]) => {
  if (contract.status === 'paid') return 'paid';
  const overduePayment = payments.find(p => 
    p.status !== 'paid' && isPast(parseISO(p.due_date)) && !isToday(parseISO(p.due_date))
  );
  if (overduePayment) return 'overdue';
  const dueTodayPayment = payments.find(p => 
    p.status !== 'paid' && isToday(parseISO(p.due_date))
  );
  if (dueTodayPayment) return 'due_today';
  return 'pending';
};
```

**Modificar card de contrato (~linhas 1688-1821):**
- Adicionar classes condicionais para status (vermelho para atraso, amarelo para vence hoje)
- Adicionar icone de alerta no canto superior direito
- Adicionar botoes de cobranca WhatsApp na secao expandida de parcelas

**Para cada parcela em atraso:**
```jsx
{payment.status !== 'paid' && isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date)) && contract.client_phone && (
  <SendOverdueNotification
    data={{
      clientName: contract.client_name,
      clientPhone: contract.client_phone,
      contractType: 'contract',
      installmentNumber: payment.installment_number,
      totalInstallments: contract.installments,
      amount: payment.amount,
      dueDate: payment.due_date,
      daysOverdue: Math.floor((new Date().getTime() - parseISO(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      loanId: contract.id,
    }}
    className="flex-1"
  />
)}
```

**Para parcela que vence hoje:**
```jsx
{payment.status !== 'paid' && isToday(parseISO(payment.due_date)) && contract.client_phone && (
  <SendDueTodayNotification
    data={{
      clientName: contract.client_name,
      clientPhone: contract.client_phone,
      contractType: 'contract',
      installmentNumber: payment.installment_number,
      totalInstallments: contract.installments,
      amount: payment.amount,
      dueDate: payment.due_date,
      loanId: contract.id,
    }}
    className="flex-1"
  />
)}
```

**Para parcela pendente (cobranca antecipada):**
```jsx
{payment.status !== 'paid' && !isPast(parseISO(payment.due_date)) && contract.client_phone && (
  <SendEarlyNotification
    data={{
      clientName: contract.client_name,
      clientPhone: contract.client_phone,
      contractType: 'contract',
      installmentNumber: payment.installment_number,
      totalInstallments: contract.installments,
      amount: payment.amount,
      dueDate: payment.due_date,
      daysUntilDue: Math.floor((parseISO(payment.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      loanId: contract.id,
    }}
    className="flex-1"
  />
)}
```

### Arquivo 2: src/components/ProductSaleCard.tsx

**Importar componente:**
```typescript
import { SendEarlyNotification } from '@/components/SendEarlyNotification';
```

**Adicionar botao de cobranca antecipada (~linha 280):**

Apos o bloco que mostra `SendDueTodayNotification`, adicionar:

```jsx
{/* Early notification button for pending payments */}
{status === 'pending' && sale.client_phone && nextDuePayment && (
  <SendEarlyNotification
    data={{
      clientName: sale.client_name,
      clientPhone: sale.client_phone,
      contractType: 'product',
      installmentNumber: nextDuePayment.installment_number,
      totalInstallments: sale.installments,
      amount: nextDuePayment.amount,
      dueDate: nextDuePayment.due_date,
      daysUntilDue: Math.floor((parseISO(nextDuePayment.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      loanId: sale.id,
      paidCount: paidCount,
    }}
    className="w-full mt-2"
  />
)}
```

## Layout Visual Proposto

### Card de Contrato com Atraso:
```
+------------------------------------------+
| [!] Icone alerta vermelho no canto       |
|------------------------------------------|
| Cliente: Joao Silva                      |
| Tipo: Aluguel de Casa                    |
| Valor mensal: R$ 1.000,00                |
| Total a receber: R$ 12.000,00            |
|------------------------------------------|
| [v Parcelas]  [Editar]  [Excluir]        |
|------------------------------------------|
| Parcelas expandidas:                     |
| 1a 05/01 R$ 1.000  [PAGO v]             |
| 2a 05/02 R$ 1.000  [10 dias atraso]     |
|   [Enviar Cobranca WhatsApp]            |
| 3a 05/03 R$ 1.000  [Pendente]           |
|   [Cobrar Antes do Prazo]               |
+------------------------------------------+
```

### Card de Produto com Proxima Parcela Pendente:
```
+------------------------------------------+
| Produto XYZ                              |
| Cliente: Maria                           |
|------------------------------------------|
| Venda: R$ 5.000  | Recebido: R$ 1.000   |
| Falta: R$ 4.000  | Parcelas: 1/5        |
|------------------------------------------|
| 2a parcela - 15/02/2026                 |
| R$ 1.000,00                             |
| [Cobrar Antes do Prazo]  <-- NOVO       |
|------------------------------------------|
| [Pagar] [Parcelas] [Recibo] [Edit] [Del]|
+------------------------------------------+
```

## Beneficios

1. Usuarios podem enviar cobrancas de contratos e produtos da mesma forma que emprestimos
2. Interface consistente entre todas as areas do sistema
3. Cobranca antecipada permite lembrar clientes antes do vencimento
4. Mensagens personalizadas com informacoes do contrato/produto

