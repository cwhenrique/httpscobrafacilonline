
# Plano: Mover Configuração de Mensagem de Cobrança para Configurações

## Objetivo

Mover a funcionalidade de personalização de mensagens de cobrança da página "Meu Perfil" para a página "Configurações", tornando-a menos acessível a usuários casuais e mantendo o comportamento padrão funcionando para quem não quiser personalizar.

## Alterações Necessárias

### 1. Remover do Profile.tsx

**Arquivo:** `src/pages/Profile.tsx`

- Remover a importação do `BillingMessageConfigCard` (linha 71)
- Remover o uso do componente `<BillingMessageConfigCard />` (linhas 1347-1348)

### 2. Adicionar ao Settings.tsx

**Arquivo:** `src/pages/Settings.tsx`

- Adicionar a importação do `BillingMessageConfigCard`
- Adicionar o componente antes da seção de Employee Management (no final da página, antes do card de funcionários)

**Posição sugerida:** Após o card "Assistente de Voz" e antes do "Employee Management"

### 3. Comportamento Preservado

O sistema já está configurado para usar os **templates padrão** quando o usuário não tem configuração personalizada salva. A lógica em `messageUtils.ts` e nos componentes de notificação já verifica:

```typescript
// Se não tem template customizado, usa o padrão
if (!config.useCustomTemplates || !config.customTemplateOverdue) {
  // Usa geração de mensagem padrão
}
```

Isso significa que:
- Usuários que nunca acessaram Configurações continuarão recebendo as mensagens padrão
- Apenas quem for em Configurações e salvar terá templates personalizados
- O campo `useCustomTemplates` só é definido como `true` quando o usuário clica em "Salvar Templates"

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Profile.tsx` | Remover import e uso do `BillingMessageConfigCard` |
| `src/pages/Settings.tsx` | Adicionar import e uso do `BillingMessageConfigCard` |

## Resultado Esperado

- A funcionalidade de mensagens de cobrança fica "escondida" em Configurações
- Usuários que não querem personalizar continuam com o comportamento padrão
- Usuários avançados que querem personalizar podem acessar em Configurações
- Nenhuma quebra no sistema atual de envio de mensagens
