

## Implementação de Cobrança via wa.me em Veículos, Produtos, Contratos e Assinaturas

### Situação Atual
- Os botões de cobrança estão condicionados a `phone &&` em vários lugares
- **VehicleCard.tsx**: linhas 264 e 308 (Overdue e DueToday)
- **Vehicles.tsx**: linha 538 (wrapper dos botões expandidos)
- **ProductSaleCard.tsx**: linhas 222, 266, 283 (Overdue, DueToday, Early)
- **ProductSales.tsx - Contratos**: linhas 2579, 2596, 2612, 2790 (Overdue, DueToday, Early - header e expanded)
- **IPTVSubscriptionListView.tsx**: **SEM botões de cobrança** - precisa adicionar SendOverdueNotification, SendDueTodayNotification, SendEarlyNotification

### Solução

Remover as condicionais `&& phone` que envolvem os componentes de notificação, permitindo que os componentes decidam autonomamente se devem aparecer (via sua lógica interna `canShowButton`). Os componentes já implementam:
- Verificação de `canShowButton = !!data.clientPhone`
- Fallback automático para `whatsapp_link` quando sem instância
- Abertura de `MessagePreviewDialog` com botão "Abrir no WhatsApp"

#### Mudanças por Arquivo

**1. VehicleCard.tsx (2 mudanças)**
- Linha 264: Remover `vehicle.buyer_phone && (` do SendOverdueNotification
- Linha 308: Remover `status === 'due_today' && vehicle.buyer_phone && (` do SendDueTodayNotification
  - Será: `{status === 'due_today' && nextDuePayment && (`
- Ajustar `clientPhone` para `vehicle.buyer_phone || ''`

**2. Vehicles.tsx (1 mudança)**
- Linha 538: Remover `vehicle.buyer_phone &&` do wrapper que envolve os 3 botões na seção expandida
- Passar `clientPhone: vehicle.buyer_phone || ''` nos dados

**3. ProductSaleCard.tsx (3 mudanças)**
- Linha 222: Remover `sale.client_phone && (` do SendOverdueNotification
  - Será: `{status === 'overdue' && overduePayment && (`
- Linha 266: Remover `status === 'due_today' && sale.client_phone && (` do SendDueTodayNotification
  - Será: `{status === 'due_today' && nextDuePayment && (`
- Linha 283: Remover `status === 'pending' && sale.client_phone && (` do SendEarlyNotification
  - Será: `{status === 'pending' && nextDuePayment && (`
- Ajustar `clientPhone` para `sale.client_phone || ''` em todos

**4. ProductSales.tsx - Contratos (4 mudanças)**
- Linha 2579: Remover `contract.client_phone && isOverdue &&` do SendOverdueNotification
  - Será: `{isOverdue && nextPendingPayment && (`
- Linha 2596: Remover `contract.client_phone && isDueToday &&` do SendDueTodayNotification
  - Será: `{isDueToday && nextPendingPayment && (`
- Linha 2612: Remover `contract.client_phone && isPending &&` do SendEarlyNotification
  - Será: `{isPending && nextPendingPayment && (`
- Linha 2790: Remover `payment.status !== 'paid' && contract.client_phone &&` do wrapper na lista expandida
  - Será: `{payment.status !== 'paid' && (`
- Ajustar `clientPhone` para `contract.client_phone || ''` em todos

**5. IPTVSubscriptionListView.tsx (NOVO - adicionar botões de cobrança)**
```text
Estrutura adicional na célula "Ações" da tabela:
- Importar: SendOverdueNotification, SendDueTodayNotification, SendEarlyNotification
- Para cada status:
  - overdue: renderizar SendOverdueNotification (antes do botão "Pagar")
  - due_today: renderizar SendDueTodayNotification
  - pending: renderizar SendEarlyNotification
- Passar dados do cliente: clientName: fee.client?.full_name || 'Cliente', clientPhone: fee.client?.phone || ''
```

### Resultado Final

Após as mudanças:
- ✅ Botões de cobrança aparecem em **TODOS** os veículos, produtos, contratos e assinaturas
- ✅ Com instância: envia via API
- ✅ Sem instância: abre wa.me com mensagem pré-preenchida
- ✅ Sem telefone: componente não renderiza o botão (controle interno)
- ✅ Fluxo intuitivo: usuário vê que falta cadastrar telefone se necessário

### Sequência de Implementação
1. VehicleCard.tsx (remover condicionais)
2. Vehicles.tsx (remover condicionais)
3. ProductSaleCard.tsx (remover condicionais)
4. ProductSales.tsx (remover condicionais nos contratos - 4 locais)
5. IPTVSubscriptionListView.tsx (adicionar botões novos)

