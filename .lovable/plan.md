
# Bloquear WhatsApp para Usuários Trial

## Problema

Usuários trial estão podendo conectar WhatsApp, ocupando instâncias no sistema. Apenas usuários pagantes (mensal, trimestral, anual, vitalício) devem ter acesso a essa funcionalidade.

## Solução

Adicionar verificação de plano antes de permitir a conexão WhatsApp. Se o usuário for trial, mostrar uma mensagem informando que precisa de um plano pago, com botão para aquisição.

## Lógica de Identificação

Baseado na estrutura existente do sistema:
- **Trial**: `subscription_plan === 'trial'` ou `subscription_plan === null/undefined`
- **Pagante**: `subscription_plan` contém: `monthly`, `quarterly`, `annual`, `lifetime`, `mensal`, `trimestral`, `anual`, `vitalicio`

## Alterações Técnicas

### Arquivo: `src/pages/Profile.tsx`

**1. Adicionar função helper para verificar se é plano pago:**

```typescript
const isPaidPlan = (): boolean => {
  if (!profile?.subscription_plan) return false;
  const paidPlans = ['monthly', 'quarterly', 'annual', 'lifetime', 'mensal', 'trimestral', 'anual', 'vitalicio'];
  return paidPlans.some(plan => 
    profile.subscription_plan?.toLowerCase().includes(plan)
  );
};
```

**2. Modificar a seção "WhatsApp para Clientes" (linhas 1387-1600):**

Adicionar verificação condicional:
- Se `!isPaidPlan()`: mostrar card informando que funcionalidade é exclusiva para planos pagos
- Se `isPaidPlan()`: mostrar a interface normal de conexão

**3. Nova UI para usuários trial:**

```text
+--------------------------------------------------+
|  MessageCircle  WhatsApp para Clientes           |
|--------------------------------------------------|
|     [Lock Icon]                                  |
|                                                  |
|  🔒 Funcionalidade Exclusiva para Assinantes    |
|                                                  |
|  A conexão WhatsApp está disponível apenas      |
|  para planos:                                   |
|  • Mensal                                       |
|  • Trimestral                                   |
|  • Anual                                        |
|  • Vitalício                                    |
|                                                  |
|  [ Assinar Agora ]                              |
+--------------------------------------------------+
```

O botão "Assinar Agora" redireciona para o link de pagamento mensal.

**4. Bloquear funções relacionadas:**

Adicionar verificação no início das funções:
- `handleConnectWhatsApp`
- `handleReconnectWhatsApp`
- `handleRefreshQrCode`

```typescript
if (!isPaidPlan()) {
  toast.error('WhatsApp disponível apenas para planos pagos');
  return;
}
```

## Fluxo do Usuário

**Usuário Trial:**
1. Vai em "Meu Perfil"
2. Vê seção "WhatsApp para Clientes"
3. Vê mensagem de bloqueio informando que é exclusivo para assinantes
4. Tem opção de "Assinar Agora"

**Usuário Pagante:**
1. Vai em "Meu Perfil"
2. Vê seção "WhatsApp para Clientes" normal
3. Pode conectar, desconectar, recriar instância normalmente

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Profile.tsx` | Adicionar função `isPaidPlan()`, modificar renderização da seção WhatsApp, adicionar verificação nas funções de conexão |

## Comportamento Esperado

- Trial vê funcionalidade bloqueada com CTA para assinar
- Ao efetuar pagamento (webhook Cakto atualiza `subscription_plan`), na próxima visita ao perfil a funcionalidade estará liberada automaticamente
- Instâncias de WhatsApp só serão criadas para usuários pagantes
