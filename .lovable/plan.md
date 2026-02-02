

# Plano: Templates Editáveis para Mensagens de Cobrança

## Problema Atual

O sistema atual tem duas limitações:
1. O "Visualizar Exemplo" no perfil mostra uma prévia estática (não editável)
2. Edições feitas no preview antes de enviar não são salvas como template

## Solução Proposta

Criar um sistema de **templates editáveis por tipo de cobrança**, onde o usuário pode:
1. Ver exemplos das 3 mensagens (Atraso, Vencimento Hoje, Antecipada)
2. Editar diretamente o texto (apagar emojis, mudar frases, etc.)
3. Salvar como template predefinido para cada tipo

```text
┌──────────────────────────────────────────────────────────────┐
│  📝 Mensagem de Cobrança                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┬─────────────────┬───────────────────┐       │
│  │ 🔴 Atraso   │ 🟡 Vence Hoje   │ 🟢 Antecipada     │       │
│  └─────────────┴─────────────────┴───────────────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ ⚠️ *Atenção {CLIENTE}*                              │     │
│  │ ━━━━━━━━━━━━━━━━                                   │     │
│  │                                                     │     │
│  │ 🚨 *PARCELA EM ATRASO*                              │     │
│  │                                                     │     │
│  │ 💵 *Valor:* {VALOR}                                 │     │
│  │ 📊 *{PARCELA}*                                      │     │
│  │ 📅 *Vencimento:* {DATA}                             │     │
│  │ ⏰ *Dias em Atraso:* {DIAS}                         │     │
│  │                                                     │     │
│  │ {PIX}                                               │     │
│  │ {ASSINATURA}                                        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  💡 Use variáveis: {CLIENTE}, {VALOR}, {PARCELA}, {DATA}...  │
│                                                              │
│  [Restaurar Padrão]              [Salvar Templates]          │
└──────────────────────────────────────────────────────────────┘
```

## Mudanças Técnicas

### 1. Atualizar Estrutura de Configuração

Adicionar campos para templates customizados por tipo:

```typescript
interface BillingMessageConfig {
  // ... campos existentes (checkboxes)...
  
  // NOVOS: Templates customizados por tipo
  customTemplateOverdue?: string;    // Template para atraso
  customTemplateDueToday?: string;   // Template para vence hoje
  customTemplateEarly?: string;      // Template para antecipada
  useCustomTemplates?: boolean;      // Usar templates customizados
}
```

### 2. Variáveis de Substituição

Definir variáveis que o sistema substituirá pelos dados reais:

| Variável | Substituído por |
|----------|-----------------|
| `{CLIENTE}` | Nome do cliente |
| `{VALOR}` | Valor da parcela |
| `{PARCELA}` | Ex: "Parcela 3/12" |
| `{DATA}` | Data de vencimento |
| `{DIAS_ATRASO}` | Dias em atraso |
| `{MULTA}` | Valor da multa |
| `{JUROS}` | Juros por atraso |
| `{TOTAL}` | Total a pagar |
| `{PROGRESSO}` | Barra de progresso |
| `{PIX}` | Seção do PIX |
| `{ASSINATURA}` | Assinatura |

### 3. Reformular BillingMessageConfigCard

Trocar o design atual (checkboxes) por:

1. **Tabs** para os 3 tipos de mensagem (Atraso, Vence Hoje, Antecipada)
2. **Textarea editável** mostrando o template com variáveis
3. **Botão "Restaurar Padrão"** para voltar ao template original
4. **Legenda** explicando as variáveis disponíveis
5. **Botão "Salvar Templates"** para persistir

### 4. Modificar Geração de Mensagens

Nos componentes de notificação, verificar se há template customizado:

```typescript
const generateOverdueMessage = (): string => {
  const config = getBillingConfig(profile?.billing_message_config);
  
  // Se tem template customizado, usar e substituir variáveis
  if (config.useCustomTemplates && config.customTemplateOverdue) {
    return replaceTemplateVariables(config.customTemplateOverdue, data, profile);
  }
  
  // Senão, usa a lógica atual baseada em checkboxes
  return generateDefaultOverdueMessage(config, data, profile);
};
```

### 5. Função de Substituição de Variáveis

```typescript
const replaceTemplateVariables = (
  template: string, 
  data: NotificationData, 
  profile: Profile
): string => {
  return template
    .replace('{CLIENTE}', data.clientName)
    .replace('{VALOR}', formatCurrency(data.amount))
    .replace('{PARCELA}', `Parcela ${data.installmentNumber}/${data.totalInstallments}`)
    .replace('{DATA}', formatDate(data.dueDate))
    .replace('{DIAS_ATRASO}', String(data.daysOverdue || 0))
    .replace('{MULTA}', formatCurrency(data.penaltyAmount || 0))
    .replace('{JUROS}', formatCurrency(data.overdueInterestAmount || 0))
    .replace('{TOTAL}', formatCurrency(data.totalAmount))
    .replace('{PROGRESSO}', generateProgressBar(progressPercent))
    .replace('{PIX}', generatePixSection(profile))
    .replace('{ASSINATURA}', generateSignature(profile));
};
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/types/billingMessageConfig.ts` | Adicionar campos de templates customizados |
| `src/components/BillingMessageConfigCard.tsx` | Reformular para tabs + textarea editável |
| `src/lib/messageUtils.ts` | Adicionar função `replaceTemplateVariables` |
| `src/components/SendOverdueNotification.tsx` | Usar template customizado se existir |
| `src/components/SendDueTodayNotification.tsx` | Usar template customizado se existir |
| `src/components/SendEarlyNotification.tsx` | Usar template customizado se existir |

## Fluxo do Usuário

1. Usuário acessa **Meu Perfil > Mensagem de Cobrança**
2. Vê 3 abas: Atraso, Vence Hoje, Antecipada
3. Cada aba mostra o template atual em um textarea editável
4. Usuário pode editar livremente (apagar emojis, trocar texto, etc.)
5. Variáveis como `{CLIENTE}` serão substituídas automaticamente ao enviar
6. Clica em **"Salvar Templates"**
7. Nas próximas cobranças, o sistema usa o template customizado

## Benefícios

- Liberdade total para personalizar a mensagem
- Pode remover qualquer emoji ou elemento indesejado
- Templates salvos são usados automaticamente
- Ainda pode editar antes de enviar (já existe no MessagePreviewDialog)
- Botão para restaurar o padrão se errar

