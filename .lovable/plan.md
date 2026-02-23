
## Liberar conexão WhatsApp para todos os usuários

Remover a restrição de emails autorizados em 3 arquivos (5 blocos de código), permitindo que qualquer usuário conecte sua instância WhatsApp.

### Alterações

**1. `src/pages/Profile.tsx`** (2 blocos)
- Remover o bloco `allowedEmails` + `if` que bloqueia `handleConnectWhatsApp` (~linhas 400-403)
- Remover o bloco `allowedEmailsRefresh` + `if` que bloqueia `handleRefreshQR` (~linhas 464-467)

**2. `supabase/functions/whatsapp-create-instance/index.ts`** (1 bloco)
- Remover o bloco `allowedEmails` + `if` que retorna 403 (~linhas 54-59)

**3. `supabase/functions/whatsapp-get-qrcode/index.ts`** (1 bloco)
- Remover o bloco `allowedEmails` + `if` que retorna 403 (~linhas 45-48)

### Resultado
Qualquer usuário autenticado poderá conectar, reconectar e gerar QR Code para sua instância WhatsApp sem restrição de email.
