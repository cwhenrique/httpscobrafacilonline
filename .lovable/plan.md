
# Plano: Confirmação por Código WhatsApp para Dados Sensíveis

## Visão Geral
Implementar um sistema de verificação em duas etapas (2FA) que envia um código de 6 dígitos via WhatsApp antes de permitir alterações em dados financeiros sensíveis como chave PIX, link de pagamento e nome nas cobranças.

## Fluxo do Usuário

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. Usuário edita chave PIX                                      │
│                    │                                             │
│                    ▼                                             │
│  2. Sistema detecta campo sensível                               │
│                    │                                             │
│                    ▼                                             │
│  3. Modal de confirmação aparece                                 │
│     "Para sua segurança, enviaremos um código"                   │
│                    │                                             │
│                    ▼                                             │
│  4. Edge function gera código e envia via WhatsApp               │
│     (para o próprio número do usuário)                           │
│                    │                                             │
│                    ▼                                             │
│  5. Usuário digita código de 6 dígitos                          │
│     (usando input-otp já existente)                              │
│                    │                                             │
│                    ▼                                             │
│  6. Sistema valida código e aplica alteração                    │
│     (registra na auditoria com confirmação)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Campos que Exigirão Confirmação
- `pix_key` - Chave PIX
- `pix_key_type` - Tipo da chave PIX
- `payment_link` - Link de pagamento

Nota: `phone`, `email`, `full_name` e `billing_signature_name` não exigirão código pois são campos de identificação pessoal, não financeiros.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                                                                  │
│  Profile.tsx                  VerificationCodeDialog.tsx         │
│       │                              │                           │
│       │ detecta campo sensível      │ input-otp de 6 dígitos    │
│       │ abre modal ──────────────►  │                           │
│                                      │                           │
│                                      │ envia código              │
│                                      ▼                           │
│                   Edge Function: request-verification-code       │
│                   Edge Function: verify-and-update-profile       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE                                 │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              verification_codes (nova tabela)             │  │
│   │                                                           │  │
│   │  - id (uuid)                                              │  │
│   │  - user_id (uuid)                                         │  │
│   │  - code (text) - código de 6 dígitos hasheado             │  │
│   │  - field_name (text) - campo sendo alterado               │  │
│   │  - new_value (text) - novo valor proposto                 │  │
│   │  - ip_address (inet)                                      │  │
│   │  - user_agent (text)                                      │  │
│   │  - expires_at (timestamptz) - expira em 5 minutos         │  │
│   │  - verified_at (timestamptz)                              │  │
│   │  - attempts (int) - máximo 3 tentativas                   │  │
│   │  - created_at (timestamptz)                               │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │           profile_audit_log (tabela existente)            │  │
│   │  + verification_id (uuid) - referência ao código usado    │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Etapas de Implementação

### 1. Criar Tabela verification_codes

Nova tabela para armazenar códigos de verificação temporários:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Identificador único |
| user_id | uuid | Referência ao usuário |
| code | text | Hash do código de 6 dígitos |
| field_name | text | Campo sendo alterado (pix_key, payment_link) |
| pending_updates | jsonb | Todas as alterações pendentes |
| ip_address | inet | IP de onde foi solicitado |
| user_agent | text | Navegador/dispositivo |
| expires_at | timestamptz | Expira em 5 minutos |
| verified_at | timestamptz | Quando foi verificado |
| attempts | int | Contador de tentativas (máx 3) |
| created_at | timestamptz | Data de criação |

Políticas RLS:
- Usuários podem inserir/visualizar apenas seus próprios códigos
- Nenhuma operação de UPDATE/DELETE permitida (imutável)

### 2. Criar Edge Function request-verification-code

Esta função:
1. Recebe as alterações propostas do perfil
2. Verifica se algum campo requer confirmação (pix_key, payment_link)
3. Gera código aleatório de 6 dígitos
4. Salva código hasheado no banco com expiração de 5 minutos
5. Envia código via WhatsApp para o próprio usuário (usando send-whatsapp-to-self)
6. Retorna indicação de que código foi enviado

Mensagem WhatsApp:
```
🔐 *Código de Verificação CobraFácil*

Seu código para alterar a Chave PIX é:

*123456*

Este código expira em 5 minutos.

⚠️ Se você não solicitou esta alteração, ignore esta mensagem e altere sua senha imediatamente.
```

### 3. Criar Edge Function verify-and-update-profile

Esta função:
1. Recebe o código digitado pelo usuário
2. Valida se o código está correto e não expirou
3. Verifica se não excedeu 3 tentativas
4. Se válido, aplica as alterações no perfil
5. Registra na auditoria com referência ao código de verificação
6. Marca o código como verificado

### 4. Criar Componente VerificationCodeDialog

Componente React que:
- Exibe modal de confirmação
- Mostra input OTP de 6 dígitos (usando input-otp existente)
- Exibe timer de expiração (5 minutos)
- Permite reenviar código após 60 segundos
- Mostra feedback de erro/sucesso

### 5. Atualizar Profile.tsx

Modificar as funções de save (handleSavePix, handleSavePaymentLink):
1. Detectar se campo requer verificação
2. Abrir modal VerificationCodeDialog ao invés de salvar diretamente
3. Após verificação bem-sucedida, atualizar UI

### 6. Atualizar useProfile.ts

Adicionar nova função `updateProfileWithVerification`:
- Verifica se alterações incluem campos sensíveis
- Se sim, inicia fluxo de verificação
- Se não, atualiza normalmente

---

## Detalhes Técnicos

### Geração de Código Seguro
```typescript
// Gerar código de 6 dígitos criptograficamente seguro
const code = Array.from(crypto.getRandomValues(new Uint8Array(3)))
  .map(b => (b % 10).toString())
  .join('')
  .padEnd(6, '0');

// Hash do código para armazenamento
const hashedCode = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(code + userId)
);
```

### Campos que Exigem Verificação
```typescript
const VERIFICATION_REQUIRED_FIELDS = [
  'pix_key',
  'pix_key_type',
  'payment_link'
];
```

### Validações de Segurança
1. Código expira em 5 minutos
2. Máximo de 3 tentativas por código
3. Rate limit: máximo 5 códigos por hora por usuário
4. IP e User Agent registrados para auditoria
5. Usuário deve ter WhatsApp conectado (fallback: usar telefone cadastrado via API global)

### Fallback se WhatsApp não Conectado
Se o usuário não tiver WhatsApp conectado:
- Usar edge function `send-whatsapp` com o telefone cadastrado no perfil
- Mensagem enviada via instância global do CobraFácil

---

## Arquivos a Serem Criados/Modificados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `verification_codes` |
| `supabase/functions/request-verification-code/index.ts` | Nova edge function |
| `supabase/functions/verify-and-update-profile/index.ts` | Nova edge function |
| `supabase/config.toml` | Adicionar novas funções |
| `src/components/VerificationCodeDialog.tsx` | Novo componente |
| `src/pages/Profile.tsx` | Integrar verificação no save de PIX |
| `src/hooks/useProfile.ts` | Adicionar funções de verificação |

---

## Benefícios de Segurança

1. **Proteção contra acesso não autorizado**: Mesmo com sessão ativa, alterações críticas exigem confirmação
2. **Rastreabilidade completa**: Cada alteração tem código de verificação vinculado na auditoria
3. **Notificação ao usuário**: Tentativas de alteração são notificadas via WhatsApp
4. **Rate limiting**: Previne ataques de força bruta
5. **Expiração rápida**: Códigos válidos por apenas 5 minutos
