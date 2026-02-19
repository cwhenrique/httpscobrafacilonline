

# Adicionar Contratos ao Relatório Diário

## Objetivo
Incluir a categoria "Contratos" no relatório diário do WhatsApp, seguindo o mesmo padrão já existente para Veículos e Produtos.

## Como ficará no relatório

```text
⏰ *VENCE HOJE* — R$ X.XXX,XX

💵 Empréstimos (2)
...

📄 Contratos (1)
• João Silva — R$ 500,00
  ↳ Aluguel Apt 202 • Parcela 3/12

🚗 Veículos (1)
...

🚨 *EM ATRASO* — R$ X.XXX,XX

📄 Contratos (2)
• Maria Santos — R$ 300,00
  ↳ 5 dias de atraso • Contrato Mensal • Parcela 2/6
```

## Alterações Técnicas

### Arquivo: `supabase/functions/daily-summary/index.ts`

1. **Nova query paralela** (linha 289, no `Promise.all`):
   - Consultar `contract_payments` com join em `contracts` para obter `client_name`, `contract_type` e `installments`
   - Filtrar por `user_id`, `status = 'pending'`

2. **Nova interface `ContractInfo`** (similar a `VehicleInfo` e `ProductInfo`):
   - `id`, `clientName`, `contractType`, `amount`, `installment`, `totalInstallments`, `daysOverdue`

3. **Categorizar contratos** em `dueTodayContracts` e `overdueContracts` (mesmo padrão de veículos/produtos)

4. **Incluir nos totais**:
   - `totalDueToday` soma `contractTotalToday`
   - `grandTotalOverdue` soma `contractTotalOverdue`
   - `hasDueToday`, `hasOverdue`, `totalDueTodayCount`, `totalOverdueCount` incluem contratos

5. **Adicionar seções de contratos na mensagem**:
   - Bloco "Vence Hoje": seção `📄 Contratos (N)` entre Empréstimos e Veículos
   - Bloco "Em Atraso": seção `📄 Contratos (N)` entre Empréstimos e Veículos

6. **Incluir contratos ativos nas métricas "Sua Carteira"**:
   - Adicionar linha `▸ Contratos ativos: X`

