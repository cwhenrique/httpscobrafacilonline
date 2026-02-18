
# Redesign: Fluxo de Caixa + Balanço Financeiro Integrado

## Problema identificado

O usuário apontou que a área de **Fluxo de Caixa** está confusa e deseja uma visão única e clara que integre:
- **Capital Inicial** (editável, baseado nos empréstimos)
- **Saídas** = empréstimos concedidos **+** contas a pagar (se o usuário quiser incluir)
- **Entradas** = apenas pagamentos recebidos de empréstimos
- **Saldo Atual** = resultado do fluxo

Além disso, o card de **Balanço Financeiro** atual repete informações e fica confuso.

## Proposta de redesign

### Novo Card Único: "Fluxo de Caixa & Balanço"

Unificar o `CashFlowCard` (componente em `src/components/reports/CashFlowCard.tsx`) e o bloco do Balanço Financeiro (inline em `ReportsLoans.tsx`) em um **único card mais claro**, com seções bem definidas.

### Layout proposto

```
┌──────────────────────────────────────────────────────────────────┐
│  💼 Fluxo de Caixa                                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── CAPITAL INICIAL ─────────────────────────────────────┐    │
│  │ R$ 38.200  [lápis - clique para editar]                  │    │
│  │ Baseado nos seus empréstimos · Editável                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  SAÍDAS DO PERÍODO                    ENTRADAS DO PERÍODO        │
│  ┌──────────────────────────┐   ┌──────────────────────────┐    │
│  │ 🔴 Empréstimos           │   │ 🟢 Recebido              │    │
│  │    R$ 31.000             │   │    R$ 37.920             │    │
│  │ 🔴 Contas a pagar ────── │   │                          │    │
│  │    R$ 1.240  [toggle ON] │   │                          │    │
│  │ ─────────────────────── │   │                          │    │
│  │ Total saídas: R$ 32.240  │   │ Total: R$ 37.920         │    │
│  └──────────────────────────┘   └──────────────────────────┘    │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │        SALDO ATUAL  R$ 45.120    (em caixa)              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Capital na Rua: R$ 5.883   |   Lucro: R$ 11.375               │
│  Resultado Líquido: + R$ 18.295                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Toggle "Incluir contas a pagar nas saídas"

O usuário poderá ligar/desligar a inclusão das contas a pagar nas saídas com um **Switch** dentro do card, evitando a duplicação de dois cards separados.

---

## Mudanças técnicas

### 1. `src/components/reports/CashFlowCard.tsx` — Reescrita do componente

Adicionar novas props:
```typescript
interface CashFlowCardProps {
  // existentes:
  initialBalance: number;
  calculatedInitialBalance: number;
  loanedInPeriod: number;
  totalOnStreet: number;
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
  // novas:
  billsPaidTotal: number;          // total de contas pagas no período
  billsPendingTotal: number;       // total de contas pendentes
  billsCount: number;              // quantidade de contas no período
  netResult: number;               // resultado líquido (calculado em ReportsLoans)
}
```

Novo layout interno:
1. **Seção Capital Inicial** — botão clicável com ícone de lápis, valor em destaque, legenda "Baseado nos seus empréstimos · Clique para editar"
2. **Duas colunas: Saídas | Entradas**
   - Saídas: linha "Empréstimos concedidos" + linha "Contas a pagar" com **Switch** para incluir/excluir + subtotal
   - Entradas: "Pagamentos recebidos" + subtotal
3. **Saldo Atual** — card destacado verde/vermelho (igual ao atual, mantido)
4. **Rodapé** — Capital na Rua | Lucro | Resultado Líquido (três métricas em linha)

### 2. `src/pages/ReportsLoans.tsx` — Pequenos ajustes

- Passar as novas props `billsPaidTotal`, `billsPendingTotal`, `billsCount`, `netResult` para o `<CashFlowCard>`
- **Remover** o bloco do "Custos do Período" (linhas 1200–1273) — as contas passam a viver dentro do CashFlowCard
- **Remover** o bloco do "Balanço Financeiro do Período" (linhas 1275–1341) — substituído pelo rodapé do novo CashFlowCard
- Manter toda a lógica de `billsStats` e `balanceStats` existente, apenas mudar onde é renderizado

### 3. `src/components/reports/CashFlowConfigModal.tsx` — Sem alterações

O modal de configuração do saldo inicial permanece exatamente como está.

---

## Estado local: `includeBillsInOutflows`

Um `useState(true)` dentro do `CashFlowCard` controlará se as contas a pagar entram no cálculo de saídas ou não. O saldo atual e o resultado líquido recalculam em tempo real conforme o toggle muda, sem necessidade de persistência.

---

## Ordem de implementação

1. Atualizar interface de props do `CashFlowCard` com os novos campos de bills e netResult
2. Reescrever o layout interno do `CashFlowCard` com as seções descritas
3. Remover os cards de "Custos do Período" e "Balanço Financeiro" do `ReportsLoans.tsx`
4. Passar as novas props para `<CashFlowCard>` em `ReportsLoans.tsx`

---

## Arquivos modificados

- `src/components/reports/CashFlowCard.tsx` — Reescrita do layout
- `src/pages/ReportsLoans.tsx` — Remoção de cards redundantes + passagem de novas props
