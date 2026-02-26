

## Plano: Atualizar opções de assinatura do Relatório Diário

### Alterações em `src/pages/AutoReports.tsx`

1. **Substituir a constante `CAKTO_CHECKOUT_URL`** pelo link mensal e adicionar o link anual:
   - Mensal: `https://pay.cakto.com.br/3c4qf8i` (já existente, R$ 19,90/mês)
   - Anual: `https://pay.cakto.com.br/us9zu34`

2. **Substituir os dois botões "Assinar"** (linhas 154-160 e 206-213) por uma seção com **dois cards de plano** lado a lado:
   - **Mensal**: R$ 19,90/mês — link atual
   - **Anual**: com preço anual e badge de economia — link `https://pay.cakto.com.br/us9zu34`

3. **Também atualizar o banner no Dashboard** (`src/pages/Dashboard.tsx` linha 312) para manter consistência, se desejado — ou manter apenas o mensal lá.

### Detalhes técnicos
- Remover constante única `CAKTO_CHECKOUT_URL`
- Criar objeto `CHECKOUT_LINKS = { monthly: '...3c4qf8i', annual: '...us9zu34' }`
- Layout: dois cards com ícones Calendar/Star similar ao `SubscriptionExpiringBanner`

