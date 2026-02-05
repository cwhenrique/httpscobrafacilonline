
# Plano: Adicionar Botões de Cobrança WhatsApp nos Veículos

## Objetivo

Adicionar os mesmos botões de cobrança via WhatsApp que existem na área de Empréstimos para a página de Veículos:
- **Enviar Cobrança** (parcela em atraso)
- **Vence Hoje** (parcela vencendo hoje)
- **Antecipar** (parcela pendente futura)

---

## Situação Atual

| Área | Botões de Cobrança |
|------|-------------------|
| Empréstimos | ✅ SendOverdueNotification, SendDueTodayNotification, SendEarlyNotification |
| Produtos | ✅ Já implementado no ProductSaleCard.tsx |
| Contratos | ✅ Já implementado no ProductSales.tsx |
| Assinaturas IPTV | ✅ Botão "Cobrar" customizado |
| **Veículos** | ❌ **Não tem** - será implementado |

---

## Alterações Necessárias

### Arquivo: `src/pages/Vehicles.tsx`

#### 1. Importar os componentes de notificação

```typescript
import SendOverdueNotification from '@/components/SendOverdueNotification';
import SendDueTodayNotification from '@/components/SendDueTodayNotification';
import { SendEarlyNotification } from '@/components/SendEarlyNotification';
```

#### 2. Adicionar botões na lista de parcelas expandida (linha ~500-525)

Para cada parcela na lista expandida do veículo, adicionar os botões condicionalmente:

```tsx
{vehiclePaymentsForCard.map((payment) => {
  const paymentDueDate = parseISO(payment.due_date);
  const isOverdue = payment.status !== 'paid' && isPast(paymentDueDate) && !isToday(paymentDueDate);
  const isDueToday = payment.status !== 'paid' && isToday(paymentDueDate);
  const isPending = payment.status !== 'paid' && !isPast(paymentDueDate);
  const daysOverdue = isOverdue ? Math.floor((new Date().getTime() - paymentDueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const daysUntilDue = isPending ? Math.max(1, Math.floor((paymentDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const paidPaymentsCount = vehiclePaymentsForCard.filter(p => p.status === 'paid').length;

  return (
    <div key={payment.id} className="space-y-2">
      {/* Linha existente com informações da parcela */}
      <div className={cn("flex items-center justify-between p-2 rounded-lg text-sm", ...)}>
        ...
      </div>
      
      {/* NOVO: Botões de cobrança WhatsApp */}
      {payment.status !== 'paid' && vehicle.buyer_phone && (
        <div className="pl-2">
          {isOverdue && (
            <SendOverdueNotification
              data={{
                clientName: vehicle.buyer_name || vehicle.seller_name,
                clientPhone: vehicle.buyer_phone,
                contractType: 'vehicle',
                installmentNumber: payment.installment_number,
                totalInstallments: vehicle.installments,
                amount: payment.amount,
                dueDate: payment.due_date,
                daysOverdue: daysOverdue,
                loanId: vehicle.id,
                paidCount: paidPaymentsCount,
              }}
              className="w-full"
            />
          )}
          {isDueToday && (
            <SendDueTodayNotification
              data={{
                clientName: vehicle.buyer_name || vehicle.seller_name,
                clientPhone: vehicle.buyer_phone,
                contractType: 'vehicle',
                installmentNumber: payment.installment_number,
                totalInstallments: vehicle.installments,
                amount: payment.amount,
                dueDate: payment.due_date,
                loanId: vehicle.id,
                paidCount: paidPaymentsCount,
              }}
              className="w-full"
            />
          )}
          {isPending && (
            <SendEarlyNotification
              data={{
                clientName: vehicle.buyer_name || vehicle.seller_name,
                clientPhone: vehicle.buyer_phone,
                contractType: 'vehicle',
                installmentNumber: payment.installment_number,
                totalInstallments: vehicle.installments,
                amount: payment.amount,
                dueDate: payment.due_date,
                daysUntilDue: daysUntilDue,
                loanId: vehicle.id,
                paidCount: paidPaymentsCount,
              }}
              className="w-full"
            />
          )}
        </div>
      )}
    </div>
  );
})}
```

#### 3. Adicionar botões no card principal (parcela próxima)

Na área visível do card do veículo (antes de expandir), mostrar o botão de cobrança para a próxima parcela pendente se estiver em atraso ou vencendo hoje.

---

## Resumo

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Vehicles.tsx` | Importar SendOverdueNotification, SendDueTodayNotification, SendEarlyNotification |
| `src/pages/Vehicles.tsx` | Adicionar botões na lista expandida de parcelas |
| `src/pages/Vehicles.tsx` | Adicionar botões no card principal para próxima parcela |

---

## Resultado Final

**No card de cada veículo:**
- Se a próxima parcela está em atraso: botão vermelho "Enviar Cobrança"
- Se vence hoje: botão amarelo "Vence Hoje"
- Se está pendente: botão "Cobrar Antes"

**Na lista expandida de parcelas:**
- Cada parcela não paga terá seu botão de cobrança correspondente ao status

Os botões funcionarão exatamente como na área de empréstimos:
1. Aviso de spam ao clicar
2. Preview da mensagem editável
3. Envio via WhatsApp configurado
4. Cooldown de 1 hora por parcela
