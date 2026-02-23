
# Migrar WhatsApp de Evolution API para UAZAPI

## Resumo

Substituir toda a integracao com Evolution API pela UAZAPI em todas as 31 edge functions. A UAZAPI usa uma arquitetura diferente onde cada instancia tem seu proprio `token` (retornado na criacao), e operacoes administrativas usam um `admintoken` global.

## Credenciais

- **URL**: `https://free.uazapi.com`
- **AdminToken**: `ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t`

Serao armazenados como secrets: `UAZAPI_URL` e `UAZAPI_ADMIN_TOKEN`

## Mudancas no Banco de Dados

Adicionar coluna `whatsapp_instance_token` na tabela `profiles` para armazenar o token da instancia retornado pela UAZAPI (cada instancia tem seu proprio token).

## Mapeamento de Endpoints

```text
Evolution API                                    UAZAPI
---------------------------------------------    ----------------------------------------
POST /instance/create                            POST /instance/init
     header: apikey                                   header: admintoken
     body: {instanceName, qrcode, ...}               body: {name}
     retorna: QR code                                 retorna: {token, ...}

GET  /instance/connectionState/{instance}        GET  /instance/status
     header: apikey                                   header: token (da instancia)
     estado: "open"/"close"                           estado: "connected"/"disconnected"

GET  /instance/connect/{instance}                POST /instance/connect
     header: apikey                                   header: token
     retorna: QR code                                 body: {} (sem phone = gera QR)

DELETE /instance/logout/{instance}               POST /instance/disconnect
       header: apikey                                 header: token

DELETE /instance/delete/{instance}               DELETE /instance/delete
       header: apikey                                 header: admintoken

POST /message/sendText/{instance}                POST /send/text
     header: apikey                                   header: token
     body: {number, text}                             body: {number, text}
```

## Arquivos Modificados

### Fase 1: Infraestrutura (secrets + banco)

1. **Adicionar secrets**: `UAZAPI_URL` e `UAZAPI_ADMIN_TOKEN`
2. **Migracao SQL**: adicionar `whatsapp_instance_token TEXT` na tabela `profiles`

### Fase 2: Edge Functions de Conexao do Usuario (5 arquivos)

Estas funcoes gerenciam a instancia do usuario (criar, QR code, status, desconectar, reset):

1. **`whatsapp-create-instance/index.ts`** - Criar instancia via `POST /instance/init` com `admintoken`, salvar o `token` retornado no `profiles.whatsapp_instance_token`, depois chamar `POST /instance/connect` com o `token` para gerar QR code
2. **`whatsapp-get-qrcode/index.ts`** - Buscar QR code via `GET /instance/status` com `token` da instancia (o status retorna QR se estiver em `connecting`)
3. **`whatsapp-check-status/index.ts`** - Verificar status via `GET /instance/status` com `token`, mapear estados (`connected`/`disconnected`/`connecting`)
4. **`whatsapp-disconnect/index.ts`** - Desconectar via `POST /instance/disconnect` com `token`
5. **`whatsapp-force-reset/index.ts`** - Deletar via `DELETE /instance/delete` com `admintoken`, recriar com `POST /instance/init`

### Fase 3: Edge Functions de Envio para Clientes (2 arquivos)

Enviam mensagens usando a instancia do usuario:

6. **`send-whatsapp-to-client/index.ts`** - Enviar texto via `POST /send/text` com `token` do usuario (lido de `profiles.whatsapp_instance_token`)
7. **`send-whatsapp-to-self/index.ts`** - Enviar para si mesmo via `POST /send/text` com `token` do usuario

### Fase 4: Edge Functions de Notificacoes do Sistema (19 arquivos)

Estas usam instancias fixas ("notficacao" ou "VendaApp"). Para UAZAPI, sera necessario criar essas instancias uma vez e armazenar seus tokens como secrets (`UAZAPI_SYSTEM_TOKEN`).

8. **`send-whatsapp/index.ts`** - Instancia "notficacao" do sistema
9. **`send-whatsapp-cobrafacil/index.ts`** - Instancia "VendaApp"
10. **`check-overdue-loans/index.ts`**
11. **`check-overdue-contracts/index.ts`**
12. **`check-overdue-vehicles/index.ts`**
13. **`check-loan-reminders/index.ts`**
14. **`check-contract-reminders/index.ts`**
15. **`check-vehicle-reminders/index.ts`**
16. **`check-bills-due/index.ts`**
17. **`check-trial-expiring/index.ts`**
18. **`check-subscription-expiring/index.ts`**
19. **`check-expired-subscriptions/index.ts`**
20. **`check-expired-pending-messages/index.ts`**
21. **`auto-client-billing/index.ts`**
22. **`daily-summary/index.ts`**
23. **`morning-greeting/index.ts`**
24. **`weekly-summary/index.ts`**
25. **`broadcast-whatsapp/index.ts`**
26. **`send-test-whatsapp/index.ts`**

### Fase 5: Edge Functions de Webhook (5 arquivos)

27. **`whatsapp-connection-webhook/index.ts`** - Adaptar para formato de webhook da UAZAPI
28. **`whatsapp-message-webhook/index.ts`** - Adaptar eventos de mensagem
29. **`whatsapp-status-webhook/index.ts`** - Adaptar eventos de status
30. **`whatsapp-configure-webhook/index.ts`** - Usar `POST /webhook/set` com `token`
31. **`whatsapp-configure-voice-webhook/index.ts`** - Adaptar

### Fase 6: Outros

32. **`cakto-webhook/index.ts`** - Usa Evolution para enviar mensagens apos pagamento
33. **`process-voice-query/index.ts`** - Usa Evolution para enviar resposta de voz

### Fase 7: Frontend

34. **`src/contexts/WhatsAppStatusContext.tsx`** - Sem mudanca (chama edge functions, nao a API diretamente)
35. **`src/pages/PvWhatsapp.tsx`** e componentes de configuracao - Verificar se fazem chamadas diretas

## Padrao de Codigo UAZAPI

Todas as funcoes seguirao este padrao:

```text
// Para operacoes administrativas (criar/deletar instancia):
const uazapiUrl = Deno.env.get('UAZAPI_URL');       // https://free.uazapi.com
const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN');
headers: { 'admintoken': adminToken }

// Para operacoes de instancia do usuario:
// token lido de profiles.whatsapp_instance_token
headers: { 'token': instanceToken }

// Para enviar mensagem:
POST ${uazapiUrl}/send/text
headers: { 'token': instanceToken }
body: { number: "5517...", text: "mensagem" }

// Para instancias do sistema (notificacoes):
const systemToken = Deno.env.get('UAZAPI_SYSTEM_TOKEN');
headers: { 'token': systemToken }
```

## Pre-requisitos

Antes de implementar, sera necessario:

1. Criar as instancias de sistema na UAZAPI (equivalente a "notficacao" e "VendaApp") e obter seus tokens
2. Armazenar os tokens como secrets

## Ordem de Implementacao

A implementacao sera feita em etapas para minimizar risco:

1. Adicionar secrets e coluna no banco
2. Migrar as 5 funcoes de conexao (criar instancia, QR, status, desconectar, reset)
3. Migrar as 2 funcoes de envio para clientes
4. Migrar as 19 funcoes de notificacoes do sistema
5. Migrar as 5 funcoes de webhook
6. Migrar as 2 funcoes restantes (cakto, voice)

Total: ~33 arquivos modificados, 1 migracao de banco, 3-4 novos secrets
