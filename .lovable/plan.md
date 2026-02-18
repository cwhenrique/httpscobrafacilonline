
# Integração de Contas a Pagar com Relatório de Empréstimos

## Objetivo
Criar um card de "Custos Mensais" no Relatório de Empréstimos (`ReportsLoans.tsx`) que busca os dados já existentes da tela "Minhas Contas a Pagar" (`bills`) e exibe um balanço financeiro completo de entradas vs. saídas, incluindo as contas pagas no período.

---

## O que será construído

### 1. Novo Card: "Custos do Período" no Relatório de Empréstimos

Um card novo, visualmente integrado ao fluxo de caixa já existente, que exibirá:

- **Total de contas no período**: soma de todas as contas cujo `due_date` cai dentro do filtro de data selecionado
- **Contas pagas**: soma e quantidade de contas com `status = 'paid'` no período
- **Contas pendentes/em atraso**: soma e quantidade das não pagas
- Divisão por tipo: **Pessoal** vs. **Empresa** (`owner_type`)
- Lista resumida das contas do período (colapsável), agrupadas por categoria

### 2. Card de Balanço Financeiro Completo (Entradas vs. Saídas)

Abaixo do Fluxo de Caixa existente, um novo card "Balanço do Período" que mostra:

```text
ENTRADAS                         SAÍDAS
+ Recebido em empréstimos        - Emprestado (capital saído)
+ Lucro realizado (juros)        - Contas pagas no período
                                 - Contas pendentes do período
= RESULTADO LÍQUIDO (positivo/negativo)
```

Este balanço permite ao usuário enxergar se, considerando todos os gastos, o negócio está gerando lucro real.

### 3. Hook `useBills` já existe — apenas reutilização

Não há criação de novas tabelas ou migrações. O hook `useBills.ts` já lê a tabela `bills` corretamente com RLS. A integração é puramente de **apresentação** no frontend.

---

## Arquitetura técnica

### Fluxo de dados

```text
bills (tabela existente)
    └── useBills() hook (já existe)
            └── ReportsLoans.tsx
                    ├── filtra por dateRange (due_date ou paid_date)
                    ├── Card "Custos do Período" (novo)
                    └── Card "Balanço Financeiro" (novo)
```

### Lógica de filtro de contas por período

- Para contas **pagas**: filtra por `paid_date` dentro do `dateRange` selecionado (o dinheiro saiu nessa data)
- Para contas **pendentes/vencidas**: filtra por `due_date` dentro do `dateRange` (comprometimento no período)
- Contas virtuais (recorrentes projetadas) não são consideradas — apenas contas reais do banco

---

## Arquivos modificados

### `src/pages/ReportsLoans.tsx`
- Adicionar `import { useBills } from '@/hooks/useBills'`
- Adicionar `import` dos ícones necessários: `Receipt`, `CreditCard`, `MinusCircle`, `Scale`
- Instanciar `const { bills } = useBills()`
- Criar `billsInPeriod` (useMemo) — filtra contas pagas pelo `paid_date` e pendentes pelo `due_date` dentro do `dateRange`
- Criar `billsStats` (useMemo) — calcula totais: `totalBills`, `paidBills`, `pendingBills`, `personalBills`, `businessBills`
- Criar `balanceStats` (useMemo) — combina `filteredStats` (empréstimos) + `billsStats` para calcular resultado líquido
- Inserir o novo **Card "Custos do Período"** após o `CashFlowCard`
- Inserir o novo **Card "Balanço Financeiro"** após o card de custos

### Nenhuma migration de banco de dados necessária

---

## Layout visual dos novos cards

### Card: Custos do Período
```
[ Receipt ] Custos do Período              [Expandir ▼]
─────────────────────────────────────────────────────
  Pagas no período    Pendentes      A Vencer
  R$ 1.240            R$ 890         R$ 350
  (8 contas)          (5 contas)     (3 contas)

  Pessoal: R$ 980   |   Empresa: R$ 260

  [Lista colapsável por categoria]
```

### Card: Balanço Financeiro
```
[ Scale ] Balanço Financeiro do Período
─────────────────────────────────────────────────────
  ENTRADAS                      SAÍDAS
  Recebido:    R$ 4.500         Capital emprestado: R$ 2.000
  Juros reais: R$ 800           Contas pagas:       R$ 1.240
                                                    ─────────
  Total:       R$ 5.300         Total:              R$ 3.240

  ┌─────────────────────────────────────┐
  │  RESULTADO LÍQUIDO: + R$ 2.060     │  ← verde/vermelho
  └─────────────────────────────────────┘
```

---

## Ordem de implementação

1. Adicionar `useBills()` no componente `ReportsLoans.tsx`
2. Criar `billsInPeriod` memo com filtro de data correto
3. Criar `billsStats` memo com totais
4. Criar `balanceStats` memo combinando empréstimos + contas
5. Inserir o Card de Custos do Período no JSX
6. Inserir o Card de Balanço Financeiro no JSX
7. Testar com diferentes períodos e verificar consistência dos valores com a tela de Bills
