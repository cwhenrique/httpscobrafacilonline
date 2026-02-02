
# Plano: Personalização de Mensagens de Cobrança via Templates Configuráveis

## Objetivo

Permitir que o usuário defina quais informações do contrato/empréstimo aparecem nas mensagens de cobrança enviadas aos clientes, salvando essas preferências para uso futuro.

## Abordagem Proposta

### Opção A: Template com Toggles de Campos (Recomendada)

O usuário configura uma vez na página de perfil quais campos quer incluir nas mensagens. Cada vez que enviar uma cobrança, o sistema monta a mensagem apenas com os campos selecionados.

```text
┌──────────────────────────────────────────────────────┐
│  📝 Configurar Mensagem de Cobrança                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Campos a incluir na mensagem:                       │
│                                                      │
│  ☑️ Nome do Cliente                                  │
│  ☑️ Valor da Parcela                                 │
│  ☑️ Número da Parcela (ex: 3/12)                     │
│  ☑️ Data de Vencimento                               │
│  ☐ Dias em Atraso                                    │
│  ☐ Multa/Juros por Atraso                           │
│  ☑️ Barra de Progresso                               │
│  ☐ Lista de Todas as Parcelas                        │
│  ☑️ Chave PIX                                        │
│  ☑️ Assinatura                                       │
│                                                      │
│  Mensagem Personalizada (opcional):                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Qualquer dúvida, estou à disposição! 😊        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  [Visualizar Exemplo]        [Salvar Preferências]   │
└──────────────────────────────────────────────────────┘
```

### Opção B: Templates Predefinidos

Oferecer 2-3 templates prontos que o usuário escolhe:
- **Completo**: Todas as informações
- **Simples**: Apenas valor, vencimento e PIX
- **Mínimo**: Só valor e vencimento

## Solução Técnica

### 1. Novos Campos no Banco de Dados

Adicionar coluna na tabela `profiles` para armazenar as preferências:

```sql
ALTER TABLE profiles 
ADD COLUMN billing_message_config JSONB DEFAULT '{
  "includeClientName": true,
  "includeInstallmentNumber": true,
  "includeAmount": true,
  "includeDueDate": true,
  "includeDaysOverdue": true,
  "includePenalty": true,
  "includeProgressBar": true,
  "includeInstallmentsList": false,
  "includePaymentOptions": true,
  "includePixKey": true,
  "includeSignature": true,
  "customClosingMessage": "Qualquer dúvida, estou à disposição! 😊"
}'::jsonb;
```

### 2. Nova Seção no Perfil (Profile.tsx)

Adicionar card "Mensagem de Cobrança" na página de perfil com:
- Lista de checkboxes para cada campo
- Campo de texto para mensagem personalizada de fechamento
- Botão "Visualizar Exemplo" que abre um preview
- Botão "Salvar Preferências"

### 3. Atualizar Funções de Geração de Mensagem

Modificar `src/lib/messageUtils.ts` e os componentes de notificação para:
- Receber as configurações do perfil como parâmetro
- Montar a mensagem apenas com os campos habilitados

```typescript
interface BillingMessageConfig {
  includeClientName: boolean;
  includeInstallmentNumber: boolean;
  includeAmount: boolean;
  includeDueDate: boolean;
  includeDaysOverdue: boolean;
  includePenalty: boolean;
  includeProgressBar: boolean;
  includeInstallmentsList: boolean;
  includePaymentOptions: boolean;
  includePixKey: boolean;
  includeSignature: boolean;
  customClosingMessage: string;
}

export const generateCustomBillingMessage = (
  data: BillingData,
  config: BillingMessageConfig,
  profile: Profile
): string => {
  let message = '';
  
  if (config.includeClientName) {
    message += `Olá *${data.clientName}*!\n`;
  }
  
  if (config.includeAmount) {
    message += `💵 *Valor:* ${formatCurrency(data.amount)}\n`;
  }
  
  // ... etc para cada campo
  
  if (config.customClosingMessage) {
    message += `\n${config.customClosingMessage}\n`;
  }
  
  return message;
};
```

### 4. Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Adicionar coluna `billing_message_config` na tabela `profiles` |
| `src/hooks/useProfile.ts` | Incluir novo campo na interface `Profile` |
| `src/pages/Profile.tsx` | Adicionar seção de configuração de mensagens |
| `src/lib/messageUtils.ts` | Criar função `generateCustomBillingMessage` |
| `src/components/SendOverdueNotification.tsx` | Usar configurações do perfil |
| `src/components/SendDueTodayNotification.tsx` | Usar configurações do perfil |
| `src/components/SendEarlyNotification.tsx` | Usar configurações do perfil |

## Fluxo do Usuário

1. Usuário acessa **Meu Perfil**
2. Encontra a seção **"Mensagem de Cobrança"**
3. Marca/desmarca os campos desejados
4. Escreve uma mensagem personalizada de fechamento (opcional)
5. Clica em **"Visualizar Exemplo"** para ver como ficará
6. Clica em **"Salvar Preferências"**
7. Nas próximas cobranças, as mensagens seguirão o template configurado

## Campos Disponíveis para Configuração

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Nome do Cliente | Saudação com nome | ✅ Ativo |
| Valor da Parcela | Valor monetário | ✅ Ativo |
| Número da Parcela | Ex: "3/12" | ✅ Ativo |
| Data de Vencimento | Data formatada | ✅ Ativo |
| Dias em Atraso | Quantidade de dias | ✅ Ativo |
| Multa/Juros Atraso | Valores adicionais | ✅ Ativo |
| Barra de Progresso | Visual do progresso | ✅ Ativo |
| Lista de Parcelas | Status de todas | ❌ Inativo |
| Opções de Pagamento | Pagar só juros, etc | ✅ Ativo |
| Chave PIX | Dados para pagamento | ✅ Ativo |
| Assinatura | Nome da empresa | ✅ Ativo |
| Mensagem de Fechamento | Texto livre | "Qualquer dúvida..." |

## Benefícios

- Flexibilidade total para cada usuário
- Mensagens mais curtas/objetivas se desejado
- Personalização da linguagem
- Configuração salva (não precisa editar toda vez)
- Ainda permite edição manual antes de enviar (já existe)
