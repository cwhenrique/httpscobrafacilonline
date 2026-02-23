

## Problema Identificado

O email do usuário está salvo no banco como `clau_pogian@hotmail.com` (minúsculo), mas nas listas de emails permitidos está como `Clau_pogian@hotmail.com` (com C maiúsculo). A comparação JavaScript (`includes`) diferencia maiúsculas de minúsculas, causando o bloqueio.

## Solução

Corrigir a comparação em todos os pontos para ser case-insensitive, usando `.toLowerCase()` tanto no email do perfil quanto na lista. Isso será feito em 3 arquivos:

### 1. `src/pages/Profile.tsx`
- Nas duas listas (`allowedEmails` e `allowedEmailsRefresh`), padronizar todos os emails para minúsculas
- Comparar usando `.toLowerCase()` no email do perfil

### 2. `supabase/functions/whatsapp-get-qrcode/index.ts`
- Mesma correção: comparar com `.toLowerCase()`

### 3. `supabase/functions/whatsapp-create-instance/index.ts`
- Mesma correção: comparar com `.toLowerCase()`

### Detalhes Técnicos

Em cada ponto de verificação, a mudança será:
```typescript
// DE:
const allowedEmails = ['cw@gmail.com', ..., 'Clau_pogian@hotmail.com'];
if (!allowedEmails.includes(profile?.email || '')) {

// PARA:
const allowedEmails = ['cw@gmail.com', ..., 'clau_pogian@hotmail.com'];
if (!allowedEmails.includes((profile?.email || '').toLowerCase())) {
```

Isso resolve o problema imediatamente e previne problemas futuros com case de emails.
