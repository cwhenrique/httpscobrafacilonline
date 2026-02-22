
# Corrigir Loop Infinito na Geracao de QR Code WhatsApp

## Problema Identificado
Quando a instancia WhatsApp esta no estado `close`, o endpoint `connect` da Evolution API retorna `{"count":0}` (sem QR Code). O sistema atual fica em loop infinito porque:

1. `whatsapp-create-instance` tenta criar a instancia mas recebe 403 ("nome ja em uso")
2. Tenta logout (falha com 400)
3. Chama `connect` que retorna `{"count":0}` - sem QR
4. Retorna `pendingQr` e o frontend continua fazendo polling para sempre sem nunca receber o QR

## Solucao

### 1. Edge Function: `whatsapp-get-qrcode/index.ts`
Quando o estado for `close` ou `connecting` e o `connect` nao retornar QR, **deletar a instancia e recriar**:

- Apos Step 5 (connect) falhar em retornar QR, adicionar logica de recuperacao:
  - Se estado era `close`: deletar instancia via `DELETE /instance/delete/{name}`, aguardar 2s, recriar via `POST /instance/create` com webhook configurado
  - Extrair QR da resposta de criacao ou aguardar webhook
- Adicionar controle para nao ficar em loop de delete/recreate (limite de 1 tentativa de recreate por chamada)

### 2. Edge Function: `whatsapp-create-instance/index.ts`
Quando receber 403 ("already in use"):

- Verificar o estado da instancia existente
- Se estado for `close`: deletar a instancia e recriar em vez de apenas tentar connect
- Se estado for `connecting`: aguardar brevemente e tentar connect novamente (a instancia pode estar gerando QR)

### 3. Frontend: `src/pages/Profile.tsx`
Ajustar o polling para evitar loop infinito:

- Reduzir `maxAttempts` de 30 para 15 (30 segundos no total)
- Apos esgotar tentativas, oferecer botao "Reiniciar e Gerar Novo QR" que chama `handleRefreshQrCode(true)` com forceReset
- Adicionar tratamento para quando o backend retorna `usePairingCode: true`, mostrar opcao de codigo de pareamento automaticamente

## Detalhes Tecnicos

### Arquivo 1: `supabase/functions/whatsapp-get-qrcode/index.ts`
Adicionar bloco de recuperacao apos o Step 5 (connect):

```text
// Apos connect falhar:
// Step 5b: Recovery - delete and recreate instance
if (state === 'close' || state === 'connecting') {
  // Delete instance
  await evoFetch(`${baseUrl}/instance/delete/${instanceName}`, { method: 'DELETE' });
  await delay(2000);
  // Recreate with webhook
  const createResp = await evoFetch(`${baseUrl}/instance/create`, { ... });
  // Extract QR from response
}
```

### Arquivo 2: `supabase/functions/whatsapp-create-instance/index.ts`
Quando status 403, deletar e recriar:

```text
// Apos 403:
if (instanceState === 'close') {
  // Delete instance
  await evolutionFetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, { method: 'DELETE' });
  await delay(2000);
  // Retry create
  const retryResp = await evolutionFetch(`${evolutionApiUrl}/instance/create`, { ... });
}
```

### Arquivo 3: `src/pages/Profile.tsx`
- Reduzir maxAttempts no pollForQrCode
- Mostrar opcao de codigo de pareamento quando polling falhar

## Resumo
- 3 arquivos modificados
- 2 edge functions com logica de recuperacao (delete + recreate)
- 1 componente frontend com melhor tratamento de falha
- Sem alteracoes de banco de dados
- Resolve o loop infinito e gera QR code mesmo quando instancia esta em estado "close"
