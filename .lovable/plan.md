

## Corrigir: Reembolsos nao desativam o acesso do usuario

### Diagnostico

O webhook da Cakto (`supabase/functions/cakto-webhook/index.ts`) possui dois problemas criticos:

**Problema 1 - Reembolsos sao ignorados:**
Na linha 529-537, o webhook so processa eventos com status `approved`, `paid`, `completed`, `active`, `subscription_created`. Qualquer outro status (como `refunded`, `chargedback`, `cancelled`, `subscription_canceled`) e simplesmente ignorado com a mensagem "Transaction not approved, skipping". Ou seja, quando a Cakto envia um webhook de reembolso, o sistema nao faz nada e o usuario continua com acesso.

**Problema 2 - Compra + Reembolso + Compra = 60 dias:**
Quando o usuario compra, reembolsa e compra novamente, o sistema nao processou o reembolso (problema 1), entao na segunda compra ele ve uma assinatura ativa e **acumula** os dias (linha 755-768: `hasActiveSubscription` e true, entao chama `calculateExpirationDate(plan, currentExpiresAt)` que adiciona 30 dias em cima da data existente). Resultado: 30 + 30 = 60 dias.

### Plano de correcao

#### 1. Adicionar tratamento de eventos de reembolso/cancelamento

Antes do filtro de status validos (linha 528), adicionar um bloco que detecta eventos de reembolso e desativa o usuario:

- Eventos de reembolso a tratar: `refunded`, `chargedback`, `chargeback`, `cancelled`, `canceled`, `subscription_canceled`, `dispute`, `reversed`, `subscription_cancelled`
- Ao receber um destes eventos:
  - Buscar o usuario pelo email
  - Atualizar o perfil: `is_active = false`, `subscription_expires_at = now()`
  - Enviar mensagem WhatsApp informando que o acesso foi revogado
  - Retornar sucesso

#### 2. Registrar reembolsos no log

Adicionar logs claros para rastreabilidade de eventos de reembolso, incluindo email do usuario, evento recebido e acao tomada.

### Detalhes tecnicos

A alteracao sera feita exclusivamente em `supabase/functions/cakto-webhook/index.ts`:

```text
Linha ~528, ANTES do bloco validStatuses:

1. Definir array de status de reembolso:
   refundStatuses = ['refunded', 'chargedback', 'chargeback', 'cancelled', 
                     'canceled', 'subscription_canceled', 'subscription_cancelled',
                     'dispute', 'reversed']

2. Verificar se o status atual e um reembolso:
   if (refundStatuses.includes(statusToCheck)):
     - Buscar usuario por email (findUserByEmail)
     - Se encontrado:
       - UPDATE profiles SET is_active = false, subscription_expires_at = NOW()
       - Enviar WhatsApp ao admin/suporte informando do reembolso
       - Log: "REFUND PROCESSED - User deactivated"
     - Retornar { success: true, message: 'Refund processed, user deactivated' }
```

Nenhum outro arquivo precisa ser alterado. A edge function sera reimplantada automaticamente.

### Resultado esperado

- Reembolsos da Cakto irao desativar o usuario imediatamente
- O usuario nao conseguira mais fazer login (o Auth.tsx ja bloqueia `is_active = false`)
- Se o usuario comprar novamente apos reembolso, a conta sera reativada normalmente (como novo subscriber, sem acumular dias da compra anterior)

