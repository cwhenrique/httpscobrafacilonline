
# Plano: Adicionar Pré-Mensagem PIX nas Cobranças

## Objetivo

Permitir que o usuário configure uma mensagem personalizada que será exibida junto com a chave PIX em todas as cobranças enviadas via WhatsApp. Por exemplo:
- "Clique no link e coloque seu nome completo e valor"
- "Pagamento via PIX para [Nome]"

Esta mensagem aparecerá automaticamente em todas as cobranças (vencendo hoje, atrasadas, antecipadas, comprovantes de pagamento, etc).

## Exemplo do Resultado

### Mensagem de Cobrança (Atual)
```text
━━━━━━━━━━━━━━━━
💳 *Chave PIX CPF:* 000.000.000-00
```

### Mensagem de Cobrança (Após alteração - com pré-mensagem)
```text
━━━━━━━━━━━━━━━━
📢 Clique no link e coloque seu nome completo e valor

💳 *Chave PIX CPF:* 000.000.000-00
```

---

## Alterações Técnicas

### 1. Banco de Dados - Nova Coluna

Adicionar nova coluna `pix_pre_message` na tabela `profiles`:

```sql
ALTER TABLE profiles 
ADD COLUMN pix_pre_message text;

COMMENT ON COLUMN profiles.pix_pre_message IS 
'Mensagem personalizada exibida junto com a chave PIX nas cobranças';
```

### 2. Hook useProfile (src/hooks/useProfile.ts)

Adicionar o campo `pix_pre_message` à interface `Profile`:

```typescript
// Adicionar na interface Profile (linha ~30)
pix_pre_message: string | null;
```

### 3. Página de Perfil (src/pages/Profile.tsx)

Adicionar campo Textarea no card de PIX, abaixo do input da chave PIX:

**Visual do Card PIX Atualizado:**
```text
┌─────────────────────────────────────────────────────────┐
│  🔑 Chave PIX para Cobranças                     [✏️]  │
├─────────────────────────────────────────────────────────┤
│  Configure sua chave PIX. Ela será incluída            │
│  automaticamente nas mensagens de cobrança.            │
│                                                         │
│  📌 Tipo da Chave: [CPF ▼]                             │
│  ┌─────────────────────────────────┐                   │
│  │ 000.000.000-00                  │                   │
│  └─────────────────────────────────┘                   │
│                                                         │
│  📝 Mensagem do PIX (opcional)  ← NOVO CAMPO           │
│  ┌─────────────────────────────────┐                   │
│  │ Clique no link e coloque seu   │                   │
│  │ nome completo e valor          │                   │
│  └─────────────────────────────────┘                   │
│  Esta mensagem aparecerá junto com a chave PIX         │
│  em todas as cobranças.                                │
└─────────────────────────────────────────────────────────┘
```

**Alterações específicas:**
- Adicionar `pix_pre_message: ''` ao `formData` state (linha 88)
- Importar componente `Textarea`
- Adicionar campo Textarea no modo de edição do PIX (após linha 1248)
- Mostrar a mensagem configurada no modo de visualização
- Salvar `pix_pre_message` junto com os outros dados do PIX no `handleSavePix`

### 4. Utilitário de Mensagens (src/lib/messageUtils.ts)

Atualizar a função `generatePixSection` para aceitar a pré-mensagem como terceiro parâmetro:

**De (linhas 143-146):**
```typescript
export const generatePixSection = (
  pixKey: string | null, 
  pixKeyType: string | null
): string => {
  if (!pixKey) return '';
  return `━━━━━━━━━━━━━━━━\n💳 *${getPixKeyTypeLabel(pixKeyType)}:* ${pixKey}\n`;
};
```

**Para:**
```typescript
export const generatePixSection = (
  pixKey: string | null, 
  pixKeyType: string | null,
  pixPreMessage?: string | null
): string => {
  if (!pixKey) return '';
  let section = `━━━━━━━━━━━━━━━━\n`;
  
  // Adiciona pré-mensagem se configurada
  if (pixPreMessage && pixPreMessage.trim()) {
    section += `📢 ${pixPreMessage.trim()}\n\n`;
  }
  
  section += `💳 *${getPixKeyTypeLabel(pixKeyType)}:* ${pixKey}\n`;
  return section;
};
```

### 5. Componentes de Notificação

Atualizar as chamadas de `generatePixSection` nos seguintes componentes para incluir a pré-mensagem:

| Componente | Arquivo | Alteração |
|------------|---------|-----------|
| SendDueTodayNotification | `src/components/SendDueTodayNotification.tsx` | Linhas 143 e 184 |
| SendOverdueNotification | `src/components/SendOverdueNotification.tsx` | Linhas 237 e 296 |
| SendEarlyNotification | `src/components/SendEarlyNotification.tsx` | Linhas 111 e 157 |
| PaymentReceiptPrompt | `src/components/PaymentReceiptPrompt.tsx` | Linhas 121 e 198 |

**Alteração em cada chamada (de):**
```typescript
message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null);
```

**Para:**
```typescript
message += generatePixSection(
  profile?.pix_key || null, 
  profile?.pix_key_type || null,
  profile?.pix_pre_message || null
);
```

---

## Resumo dos Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar coluna `pix_pre_message` à tabela `profiles` |
| `src/hooks/useProfile.ts` | Adicionar `pix_pre_message` à interface Profile |
| `src/pages/Profile.tsx` | Adicionar Textarea no card de PIX + lógica de save |
| `src/lib/messageUtils.ts` | Atualizar `generatePixSection` para aceitar pré-mensagem |
| `src/components/SendDueTodayNotification.tsx` | Passar `pix_pre_message` para `generatePixSection` |
| `src/components/SendOverdueNotification.tsx` | Passar `pix_pre_message` para `generatePixSection` |
| `src/components/SendEarlyNotification.tsx` | Passar `pix_pre_message` para `generatePixSection` |
| `src/components/PaymentReceiptPrompt.tsx` | Passar `pix_pre_message` para função de geração de mensagem |

---

## Validações

- Limite de 500 caracteres para a pré-mensagem
- Trim de espaços em branco antes de salvar e exibir
- Campo opcional (pode ficar vazio)
- Não requer 2FA (não é campo sensível como a chave PIX em si)
