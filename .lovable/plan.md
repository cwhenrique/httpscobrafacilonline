
# Fluxo de Caixa nos Relatórios de Empréstimos

## Resumo

Adicionar uma funcionalidade de **Fluxo de Caixa** no relatório de empréstimos onde o usuário:
1. Define um **saldo inicial** do caixa (ex: R$ 20.000)
2. Vê o caixa **diminuir** quando novos empréstimos são criados
3. Vê o caixa **aumentar** quando recebe pagamentos
4. Acompanha o **lucro acumulado** (juros recebidos)

## Como Vai Funcionar

### Visualização

```text
+------------------------------------------------------------------+
| 💰 FLUXO DE CAIXA                                    [Configurar] |
+------------------------------------------------------------------+
| Caixa Inicial: R$ 20.000,00                                      |
+------------------+------------------+-----------------------------+
| 📤 Emprestado   | 📥 Recebido      | 💵 Caixa Atual             |
| R$ 15.000,00    | R$ 8.500,00      | R$ 13.500,00               |
|                 | (+ R$ 2.000 juros)| (Lucro: R$ 2.000,00)       |
+------------------+------------------+-----------------------------+
```

### Cálculo do Caixa

```
Caixa Atual = Caixa Inicial 
            - Σ (Principal emprestado no período)
            + Σ (Pagamentos recebidos no período)

Lucro = Σ (Juros recebidos nos pagamentos)
```

## Alterações Necessárias

### 1. Adicionar coluna no banco de dados

**Tabela:** `profiles`

**Nova coluna:**
- `cash_flow_initial_balance` - numeric - Saldo inicial do caixa

A coluna será adicionada via migration.

### 2. Atualizar interface Profile

**Arquivo:** `src/hooks/useProfile.ts`

Adicionar o campo `cash_flow_initial_balance` na interface `Profile`:

```typescript
export interface Profile {
  // ... campos existentes ...
  cash_flow_initial_balance: number | null;
}
```

### 3. Criar componente CashFlowCard

**Novo Arquivo:** `src/components/reports/CashFlowCard.tsx`

Componente que exibe:
- Botão para configurar saldo inicial (abre modal)
- Card com caixa inicial, emprestado no período, recebido, e caixa atual
- Indicador de lucro (juros)
- Gráfico de evolução do caixa

```typescript
interface CashFlowCardProps {
  initialBalance: number;
  loanedInPeriod: number;      // Principal emprestado no período
  receivedInPeriod: number;    // Pagamentos recebidos
  interestReceived: number;    // Juros recebidos (lucro)
  onUpdateInitialBalance: (value: number) => void;
}
```

### 4. Criar modal de configuração

**Novo Arquivo:** `src/components/reports/CashFlowConfigModal.tsx`

Modal simples para o usuário definir o saldo inicial do caixa:
- Input numérico para valor
- Botão salvar (atualiza profile via useProfile)

### 5. Integrar no ReportsLoans

**Arquivo:** `src/pages/ReportsLoans.tsx`

**Mudanças:**

1. Importar novos componentes:
```typescript
import { CashFlowCard } from '@/components/reports/CashFlowCard';
```

2. Usar dados do profile para saldo inicial:
```typescript
const initialBalance = profile?.cash_flow_initial_balance || 0;
```

3. Calcular métricas de fluxo de caixa:
```typescript
const cashFlowStats = useMemo(() => {
  // Principal emprestado no período (já existe em filteredStats.totalLent)
  const loanedInPeriod = filteredStats.totalLent;
  
  // Pagamentos recebidos no período (já existe em filteredStats.totalReceived)
  const receivedInPeriod = filteredStats.totalReceived;
  
  // Juros recebidos (já existe em filteredStats.realizedProfit)
  const interestReceived = filteredStats.realizedProfit;
  
  // Caixa atual
  const currentBalance = initialBalance - loanedInPeriod + receivedInPeriod;
  
  return {
    initialBalance,
    loanedInPeriod,
    receivedInPeriod,
    interestReceived,
    currentBalance,
  };
}, [initialBalance, filteredStats]);
```

4. Adicionar o componente na UI (após os filtros, antes das estatísticas):
```jsx
<CashFlowCard
  initialBalance={cashFlowStats.initialBalance}
  loanedInPeriod={cashFlowStats.loanedInPeriod}
  receivedInPeriod={cashFlowStats.receivedInPeriod}
  interestReceived={cashFlowStats.interestReceived}
  onUpdateInitialBalance={handleUpdateCashFlowBalance}
/>
```

5. Função para atualizar saldo:
```typescript
const handleUpdateCashFlowBalance = async (value: number) => {
  await updateProfile({ cash_flow_initial_balance: value });
  toast.success('Saldo inicial atualizado!');
};
```

### 6. Gráfico de Evolução do Caixa

**Dentro do CashFlowCard:**

Mostrar um pequeno gráfico de área mostrando a evolução do caixa ao longo do período selecionado:
- Linha começando no saldo inicial
- Cada empréstimo criado diminui
- Cada pagamento recebido aumenta

## Detalhes Técnicos

### Migration SQL

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cash_flow_initial_balance numeric DEFAULT 0;
```

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/reports/CashFlowCard.tsx` | Card principal do fluxo de caixa |
| `src/components/reports/CashFlowConfigModal.tsx` | Modal para configurar saldo inicial |

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/hooks/useProfile.ts` | Adicionar campo `cash_flow_initial_balance` |
| `src/pages/ReportsLoans.tsx` | Integrar componente de fluxo de caixa |

### Layout Visual do Card

```text
+------------------------------------------------------------------+
| 💰 Fluxo de Caixa                                    [⚙️ Editar] |
+------------------------------------------------------------------+
|                                                                   |
| ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ |
| │ 💵 Inicial  │  │ 📤 Saídas   │  │ 📥 Entradas │  │ 💰 Atual   │ |
| │ R$ 20.000   │  │ R$ 15.000   │  │ R$ 8.500    │  │ R$ 13.500  │ |
| │             │  │ emprestado  │  │ recebido    │  │ em caixa   │ |
| └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ |
|                                                                   |
| ┌─────────────────────────────────────────────────────────────┐  |
| │ 📈 Lucro no Período: R$ 2.000,00 (juros recebidos)          │  |
| └─────────────────────────────────────────────────────────────┘  |
+------------------------------------------------------------------+
```

### Fórmulas

| Métrica | Fórmula |
|---------|---------|
| Caixa Atual | `Inicial - Emprestado + Recebido` |
| Lucro | `Σ interest_paid dos pagamentos` |
| Saídas | `Σ principal_amount dos empréstimos criados` |
| Entradas | `Σ amount dos pagamentos recebidos` |

## Comportamento com Filtros

O fluxo de caixa respeita os filtros de período e tipo de pagamento já existentes:
- Se filtrar por "Este mês", mostra apenas empréstimos/pagamentos do mês
- Se filtrar por "Diário", mostra apenas contratos diários

O saldo inicial é sempre o mesmo (configurado pelo usuário), mas as movimentações (emprestado/recebido) variam conforme o filtro.

## Benefícios

1. **Controle de Capital**: Usuário sabe quanto dinheiro tem disponível
2. **Planejamento**: Pode ver se o caixa está aumentando ou diminuindo
3. **Lucro Visível**: Juros claramente separados do principal
4. **Integração**: Usa dados que já existem, sem duplicação
5. **Filtros**: Funciona com os filtros de período já existentes
