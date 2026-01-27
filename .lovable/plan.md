
# Plano: Sistema de Auditoria de Perfil

## Visão Geral
Implementar um sistema completo de auditoria que registre todas as alterações de dados sensíveis no perfil do usuário (PIX, telefone, email), incluindo endereço IP, data/hora e valores anteriores.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  Profile.tsx / Settings.tsx / ProfileSetupModal.tsx              │
│                            │                                     │
│                            ▼                                     │
│              useProfile.ts (updateProfile)                       │
│                            │                                     │
│                            ▼                                     │
│              Edge Function: update-profile-audited               │
│              (recebe updates + captura IP)                       │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│                                                                  │
│   ┌─────────────────────┐      ┌──────────────────────────────┐ │
│   │     profiles        │      │    profile_audit_log          │ │
│   │  (tabela existente) │◄────►│  (nova tabela de auditoria)  │ │
│   └─────────────────────┘      │  - id                         │ │
│                                │  - user_id                    │ │
│                                │  - field_name                 │ │
│                                │  - old_value                  │ │
│                                │  - new_value                  │ │
│                                │  - ip_address                 │ │
│                                │  - user_agent                 │ │
│                                │  - changed_at                 │ │
│                                └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Campos Sensíveis Monitorados
- `pix_key` - Chave PIX
- `pix_key_type` - Tipo da chave PIX
- `phone` - Telefone/WhatsApp
- `email` - Email
- `full_name` - Nome completo
- `billing_signature_name` - Nome nas cobranças
- `payment_link` - Link de pagamento

## Etapas de Implementação

### 1. Criar Tabela de Auditoria

Nova tabela `profile_audit_log` para armazenar histórico de alterações:

**Campos:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Identificador único |
| user_id | uuid | Referência ao usuário |
| field_name | text | Nome do campo alterado |
| old_value | text | Valor anterior (criptografado para dados sensíveis) |
| new_value | text | Novo valor (criptografado para dados sensíveis) |
| ip_address | inet | Endereço IP da requisição |
| user_agent | text | User agent do navegador |
| changed_at | timestamptz | Data/hora da alteração |
| changed_by | uuid | Quem fez a alteração (útil para funcionários) |

**Políticas RLS:**
- Usuários podem visualizar apenas seu próprio histórico
- Admins podem visualizar todos os registros

### 2. Criar Edge Function para Atualizações Auditadas

Nova edge function `update-profile-audited` que:
1. Recebe as atualizações do perfil
2. Captura o IP real do cliente
3. Busca os valores atuais do perfil
4. Compara quais campos sensíveis foram alterados
5. Registra cada alteração na tabela de auditoria
6. Aplica as atualizações no perfil

**Benefícios da abordagem via Edge Function:**
- Captura IP real do cliente (não disponível no frontend)
- Garante que toda alteração passe pela auditoria
- Permite validação adicional no servidor

### 3. Atualizar Hook useProfile

Modificar `updateProfile` em `src/hooks/useProfile.ts` para:
- Chamar a edge function ao invés de atualizar diretamente
- Passar informações do user agent

### 4. Atualizar ProfileSetupModal

Modificar `src/components/ProfileSetupModal.tsx` para também usar a edge function ao invés de atualização direta.

### 5. Interface para Visualizar Histórico (Opcional)

Adicionar seção na página de Perfil para visualizar o histórico de alterações, mostrando:
- Data/hora da alteração
- Campo alterado
- Valor anterior → Novo valor
- IP de origem

---

## Detalhes Técnicos

### Edge Function: update-profile-audited

```typescript
// Estrutura da requisição
{
  updates: { pix_key?: string, phone?: string, ... },
  userAgent: string
}

// Campos sensíveis monitorados
const SENSITIVE_FIELDS = [
  'pix_key',
  'pix_key_type', 
  'phone',
  'email',
  'full_name',
  'billing_signature_name',
  'payment_link'
];
```

### Captura de IP

O IP será extraído dos headers da requisição:
- `x-forwarded-for` (proxy/load balancer)
- `x-real-ip` (alternativa)
- `cf-connecting-ip` (Cloudflare)

### Segurança

1. **RLS na tabela de auditoria**: Usuários só veem seus próprios logs
2. **Logs imutáveis**: Sem políticas de UPDATE/DELETE para usuários
3. **Dados sensíveis**: Valores parcialmente mascarados na visualização

---

## Arquivos a Serem Criados/Modificados

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `profile_audit_log` com RLS |
| `supabase/functions/update-profile-audited/index.ts` | Nova edge function |
| `supabase/config.toml` | Adicionar configuração da nova função |
| `src/hooks/useProfile.ts` | Usar edge function para updates |
| `src/components/ProfileSetupModal.tsx` | Usar edge function |
| `src/pages/Profile.tsx` | Adicionar visualização do histórico (opcional) |

---

## Benefícios

1. **Rastreabilidade completa**: Saber exatamente quando, de onde e o que foi alterado
2. **Investigação de fraudes**: Identificar alterações não autorizadas
3. **Recuperação de dados**: Possibilidade de restaurar valores anteriores
4. **Compliance**: Atender requisitos de auditoria e segurança
