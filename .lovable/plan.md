

# Fallback automatico dos botoes de WhatsApp quando a instancia cair

## Problema
Quando a instancia da Evolution API cai (erro 502, sessao expirada, etc.), os botoes de cobranca tentam enviar via API e mostram erro ao usuario. O sistema so verifica o status da conexao na pagina de Perfil, entao as outras paginas (Emprestimos, Vendas, Veiculos) nao sabem que a instancia desconectou.

## Solucao
Criar um contexto global de status do WhatsApp que verifica periodicamente se a instancia esta conectada. Quando detectar desconexao, todos os botoes de cobranca mudam automaticamente para o modo fallback (link wa.me), sem mostrar erro.

## Alteracoes tecnicas

### 1. Criar contexto global `src/contexts/WhatsAppStatusContext.tsx`
- Context React que encapsula o `useWhatsAppAutoReconnect` existente
- Expoe `isInstanceConnected` (boolean) para toda a aplicacao
- Verifica o status a cada 2 minutos (usando o hook existente)
- Quando `send-whatsapp-to-client` retorna erro de conexao, marca imediatamente como desconectado
- Provider colocado no `App.tsx` (dentro do AuthProvider)

### 2. Adicionar o Provider no `src/App.tsx`
- Envolver as rotas com `<WhatsAppStatusProvider>`

### 3. Atualizar `canSendViaAPI` nos componentes de notificacao
Adicionar a verificacao `isInstanceConnected` em todos os componentes que usam `canSendViaAPI`:
- `SendOverdueNotification.tsx`
- `SendDueTodayNotification.tsx`
- `SendEarlyNotification.tsx`
- `CheckDiscountNotifications.tsx`
- `PaymentReceiptPrompt.tsx`
- `LoanCreatedReceiptPrompt.tsx`
- `SaleCreatedReceiptPrompt.tsx`
- `ReceiptPreviewDialog.tsx`
- `LoansTableView.tsx`

Em cada um, mudar de:
```typescript
const canSendViaAPI = profile?.whatsapp_instance_id && profile?.whatsapp_connected_phone && profile?.whatsapp_to_clients_enabled && clientPhone;
```
Para:
```typescript
const { isInstanceConnected } = useWhatsAppStatus();
const canSendViaAPI = isInstanceConnected && profile?.whatsapp_instance_id && profile?.whatsapp_connected_phone && profile?.whatsapp_to_clients_enabled && clientPhone;
```

### 4. Fallback automatico ao detectar erro no envio
Nos handlers `handleSend` dos componentes, quando o envio via API falhar com erro de conexao (desconectado, 502, QR Code), marcar `isInstanceConnected = false` no contexto. Isso faz com que:
- Todos os botoes mudem instantaneamente para modo "Cobrar via WhatsApp" (link wa.me)
- Nenhum erro e mostrado ao usuario
- O proximo ciclo de verificacao (2 min) pode restaurar se a instancia voltar

### 5. Manter `Profile.tsx` funcionando
O `useWhatsAppAutoReconnect` existente em Profile.tsx continua funcionando, mas agora o contexto global tambem atualiza o status. Profile.tsx pode consumir o contexto ao inves de ter seu proprio hook.

## Fluxo de funcionamento

```text
Usuario abre a pagina de Emprestimos
    |
    v
WhatsAppStatusContext verifica status (a cada 2 min)
    |
    +-- Conectado: botoes mostram "Enviar Cobranca" (via API)
    |
    +-- Desconectado: botoes mostram "Cobrar via WhatsApp" (link wa.me)
    |
    v
Se envio via API falha com erro de conexao
    |
    v
Marca isInstanceConnected = false imediatamente
    |
    v
Todos os botoes mudam para fallback (wa.me) sem mostrar erro
```

## Resultado esperado
- Quando a instancia cair, os botoes mudam automaticamente para o modo fallback
- O usuario nunca ve erros de conexao, apenas o botao muda
- A verificacao periodica (2 min) restaura o modo API quando a instancia voltar
- Nenhuma mudanca visual no modo escuro/claro

