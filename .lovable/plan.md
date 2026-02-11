

## Fallback WhatsApp via Link (wa.me) para Usuarios sem Instancia Conectada

### Problema Atual
Quando o usuario nao tem a instancia do WhatsApp conectada (Evolution API), os botoes de cobranca simplesmente desaparecem. Isso impede o usuario de cobrar seus clientes via WhatsApp.

### Solucao
Implementar um fallback que, quando a instancia nao esta conectada, ao inves de enviar via API, abre o WhatsApp Web/App do usuario com a mensagem pre-preenchida usando o link `https://wa.me/{numero}?text={mensagem}`.

O fluxo sera:
- **Instancia conectada**: Envia automaticamente pela API (comportamento atual, sem mudanca)
- **Instancia NAO conectada**: Abre o MessagePreviewDialog no modo `"copy"` com um botao extra "Abrir no WhatsApp" que gera o link `wa.me` com a mensagem editada

### Componentes Afetados (10 arquivos)

1. **MessagePreviewDialog.tsx** - Adicionar um terceiro modo `"whatsapp_link"` que mostra botao "Abrir no WhatsApp" (abre `wa.me` com texto pre-preenchido) + botao "Copiar"
2. **SendOverdueNotification.tsx** - Remover `if (!canSend) return null`, mostrar botao mesmo sem instancia, usar modo `"whatsapp_link"` no preview quando nao conectado
3. **SendDueTodayNotification.tsx** - Mesma logica do item acima
4. **SendEarlyNotification.tsx** - Mesma logica
5. **CheckDiscountNotifications.tsx** - Mesma logica
6. **PaymentReceiptPrompt.tsx** - Mesma logica para recibos
7. **LoanCreatedReceiptPrompt.tsx** - Mesma logica
8. **SaleCreatedReceiptPrompt.tsx** - Mesma logica
9. **ReceiptPreviewDialog.tsx** - Mesma logica
10. **Loans.tsx / ProductSales.tsx** - Remover condicional `profile?.whatsapp_to_clients_enabled` que esconde os botoes

### Fluxo do Usuario (sem instancia)

```text
[Clica "Enviar Cobranca"]
        |
        v
[SpamWarningDialog] --> confirma
        |
        v
[MessagePreviewDialog - modo "whatsapp_link"]
   - Pode editar a mensagem
   - Botao "Abrir no WhatsApp" (abre wa.me com texto)
   - Botao "Copiar Texto" (copia para clipboard)
```

### Detalhes Tecnicos

**MessagePreviewDialog.tsx** - Novo modo:
- Adicionar prop `clientPhone?: string`
- Quando `mode="whatsapp_link"`, mostrar botao verde "Abrir no WhatsApp" que faz `window.open(\`https://wa.me/${phone}?text=${encodeURIComponent(message)}\`, '_blank')`
- Manter tambem o botao "Copiar Texto" como opcao secundaria

**Componentes de notificacao (Send*.tsx, Check*.tsx):**
- Mudar `canSend` para `canSendViaAPI` (verifica instancia conectada)
- Adicionar `canShowButton` = `!!data.clientPhone` (so precisa ter telefone)
- Se `canSendViaAPI`: comportamento atual (envia pela API)
- Se nao `canSendViaAPI` mas tem telefone: abre preview com `mode="whatsapp_link"`
- Manter cooldown e spam warning apenas para envio via API

**Componentes de recibo (Receipt*.tsx, LoanCreated*.tsx, SaleCreated*.tsx):**
- Mesmo padrao: se nao tem instancia, usa modo `whatsapp_link` ao inves de bloquear

**Paginas (Loans.tsx, ProductSales.tsx):**
- Remover/relaxar condicional `whatsapp_to_clients_enabled` para exibir botoes
- A condicional `loan.client?.phone` continua necessaria

### Beneficios
- Usuarios podem cobrar clientes mesmo sem configurar a Evolution API
- Zero fricao para novos usuarios que ainda nao conectaram o WhatsApp
- Mantem a experiencia superior (envio automatico) para quem tem instancia
- Nenhuma mudanca no backend ou edge functions

