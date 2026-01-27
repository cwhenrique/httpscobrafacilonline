

# Implementar Fluxo de Caixa nos Relatórios de Empréstimos

## Resumo

Adicionar uma funcionalidade de **Fluxo de Caixa** no relatório de empréstimos onde o usuário:
1. Define um **saldo inicial** do caixa (ex: R$ 20.000)
2. Vê o caixa **diminuir** quando novos empréstimos são criados
3. Vê o caixa **aumentar** quando recebe pagamentos
4. Acompanha o **lucro acumulado** (juros recebidos)

## Alterações Necessárias

### 1. Adicionar coluna no banco de dados

**Tabela:** `profiles`

**Nova coluna:**
- `cash_flow_initial_balance` - numeric - Saldo inicial do caixa (default: 0)

### 2. Atualizar interface Profile

**Arquivo:** `src/hooks/useProfile.ts`

Adicionar o campo na interface:

```typescript
export interface Profile {
  // ... campos existentes ...
  cash_flow_initial_balance: number | null;
}
```

### 3. Criar componente CashFlowCard

**Novo Arquivo:** `src/components/reports/CashFlowCard.tsx`

Componente visual que exibe:
- Card com ícone de carteira e título "Fluxo de Caixa"
- Botão para configurar/editar saldo inicial
- 4 métricas em grid:
  - **Caixa Inicial**: Valor configurado pelo usuário
  - **Saídas**: Total emprestado no período
  - **Entradas**: Total recebido no período
  - **Caixa Atual**: Cálculo (Inicial - Saídas + Entradas)
- Indicador de lucro (juros recebidos)
- Cores: verde para valores positivos, vermelho para negativos

```typescript
interface CashFlowCardProps {
  initialBalance: number;
  loanedInPeriod: number;
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
}
```

### 4. Criar modal de configuração

**Novo Arquivo:** `src/components/reports/CashFlowConfigModal.tsx`

Modal simples com:
- Título "Configurar Saldo Inicial"
- Input numérico para valor (com formatação em reais)
- Texto explicativo sobre o funcionamento
- Botões Cancelar e Salvar

### 5. Integrar no ReportsLoans

**Arquivo:** `src/pages/ReportsLoans.tsx`

**Mudanças:**

1. Importar novos componentes e useProfile:
```typescript
import { CashFlowCard } from '@/components/reports/CashFlowCard';
```

2. Usar dados do profile para saldo inicial:
```typescript
const { profile, updateProfile, refetch: refetchProfile } = useProfile();
const initialBalance = profile?.cash_flow_initial_balance || 0;
```

3. Calcular métricas de fluxo de caixa (usar useMemo):
```typescript
const cashFlowStats = useMemo(() => {
  const loanedInPeriod = filteredStats.totalLent;
  const receivedInPeriod = filteredStats.totalReceived;
  const interestReceived = filteredStats.realizedProfit;
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

4. Adicionar função para atualizar saldo:
```typescript
const handleUpdateCashFlowBalance = async (value: number) => {
  const { error } = await updateProfile({ cash_flow_initial_balance: value });
  if (error) {
    toast.error('Erro ao atualizar saldo');
  } else {
    await refetchProfile();
    toast.success('Saldo inicial atualizado!');
  }
};
```

5. Adicionar o componente na UI (após o card "Period Stats", antes do "Main Stats Grid", linha ~1042):
```jsx
<CashFlowCard
  initialBalance={cashFlowStats.initialBalance}
  loanedInPeriod={cashFlowStats.loanedInPeriod}
  receivedInPeriod={cashFlowStats.receivedInPeriod}
  interestReceived={cashFlowStats.interestReceived}
  onUpdateInitialBalance={handleUpdateCashFlowBalance}
/>
```

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
| `src/hooks/useProfile.ts` | Adicionar campo `cash_flow_initial_balance` na interface |
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
| Saídas | `Σ principal_amount dos empréstimos criados no período` |
| Entradas | `Σ amount dos pagamentos recebidos no período` |

### Comportamento com Filtros

O fluxo de caixa respeita os filtros de período e tipo de pagamento já existentes:
- Se filtrar por "Este mês", mostra apenas empréstimos/pagamentos do mês
- Se filtrar por "Diário", mostra apenas contratos diários

O saldo inicial é sempre o mesmo (configurado pelo usuário), mas as movimentações (emprestado/recebido) variam conforme o filtro.

## Benefícios

1. **Controle de Capital**: Usuário sabe quanto dinheiro tem disponível
2. **Planejamento**: Pode ver se o caixa está aumentando ou diminuindo
3. **Lucro Visível**: Juros claramente separados do principal
4. **Integração**: Usa dados que já existem (filteredStats), sem duplicação
5. **Filtros**: Funciona com os filtros de período já existentes

