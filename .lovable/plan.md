
## Plano: Mostrar Botões de Cobrança em Todos os Empréstimos (com wa.me Fallback)

### Situação Atual
- Os botões de cobrança (`SendOverdueNotification`, `SendDueTodayNotification`, `SendEarlyNotification`) já implementam o fallback via `wa.me` quando a instância não está conectada
- **PORÉM**: Na página `src/pages/Loans.tsx`, os botões são renderizados condicionados a `loan.client?.phone` apenas
- **O PROBLEMA**: O usuário quer que os botões apareçam em TODOS os empréstimos, sem condicional adicional

### Análise do Código Atual
1. **SendOverdueNotification.tsx** (linhas 120-126):
   - `canSendViaAPI`: verifica se tem instância + `whatsapp_to_clients_enabled`
   - `canShowButton`: apenas verifica se `!!data.clientPhone`
   - Linha 465: `if (!canShowButton) return null;` → botão só aparece se tem telefone
   - Linhas 467 e 521: modo muda para `'whatsapp_link'` quando sem API

2. **Loans.tsx**:
   - Linha 8893: `{loan.client?.phone && (<SendOverdueNotification...)`
   - Linha 9008: `{loan.client?.phone && (<SendDueTodayNotification...)`
   - Linha 9047: `{!isPaid && !isOverdue && !isDueToday && loan.client?.phone && (...)`
   - Essas condicionais previnem renderização do componente se não há telefone

3. **LoansTableView.tsx**:
   - Importa `SendOverdueNotification` e `SendDueTodayNotification`
   - Mas não renderiza os botões (na verdade renderiza, preciso verificar melhor)

### Solução Proposta

#### 1. Manter os Componentes de Notificação Iguais
Os componentes (`SendOverdueNotification.tsx`, `SendDueTodayNotification.tsx`, `SendEarlyNotification.tsx`) **já funcionam corretamente**:
- Mostram botão se tem telefone (`canShowButton`)
- Abrem preview em modo `'whatsapp_link'` se sem instância
- Permitem editar mensagem e abrir wa.me

**Não precisa mudar nada neles.**

#### 2. Modificar Loans.tsx - Remover Condicionais de Telefone
Remover as condicionais `&& loan.client?.phone` que envolvem os componentes de notificação, deixando os componentes decidirem se devem aparecer ou não através da própria lógica `canShowButton`.

**Mudanças específicas:**
- Linha 8893: `{loan.client?.phone && (` → remover condicional `loan.client?.phone &&`
- Linha 9008: `{loan.client?.phone && (` → remover condicional `loan.client?.phone &&`
- Linha 9047: `{!isPaid && !isOverdue && !isDueToday && loan.client?.phone && (` → remover `loan.client?.phone &&`

#### 3. Verificar LoansTableView.tsx
Verificar se os botões de notificação já estão sendo renderizados na tabela. Se estiverem, avaliar se há condicionais de `phone` lá também.

### Resultado
Após as mudanças:
1. Botões de cobrança aparecem em **TODOS** os empréstimos que têm status relevante (em atraso, vence hoje, em breve)
2. Se o empréstimo **TEM** telefone do cliente:
   - Botão ativado → abre preview com mensagem
   - Se tem instância → envio automático via API
   - Se sem instância → abre wa.me com mensagem pré-preenchida
3. Se o empréstimo **NÃO TEM** telefone:
   - Botão desabilitado ou não aparece (componente controla isso)

### Benefício
- Usuário nunca é impedido de cobrar um cliente
- Fluxo intuitivo: sempre há um botão disponível
- Se faltar telefone, usuário vê que precisa cadastrar (UI feedback)

