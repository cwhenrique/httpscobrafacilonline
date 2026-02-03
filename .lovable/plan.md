
# Plano: Registro de Gastos para Veiculos Alugados

## Visao Geral

Implementar um sistema de registro de gastos (manutencao, seguro, IPVA, multas, etc) para contratos de aluguel de veiculos, permitindo que o usuario calcule o lucro liquido real de cada veiculo.

## Estrutura da Solucao

```text
+------------------------------------------+
|  Card do Veiculo Alugado                 |
+------------------------------------------+
|  Cliente: Joao Silva                     |
|  Placa: ABC-1234                         |
|  Valor mensal: R$ 600,00                 |
|  Total recebido: R$ 3.600,00             |
|                                          |
|  +------------------------------------+  |
|  | Gastos      | Lucro Liquido        |  |
|  | R$ 850,00   | R$ 2.750,00          |  |
|  +------------------------------------+  |
|                                          |
|  [Ver Parcelas] [Gastos] [Editar] [X]   |
+------------------------------------------+

Dialog de Gastos:
+------------------------------------------+
|  Gastos - ABC-1234 (Onix Branco)         |
+------------------------------------------+
|  Total de Gastos: R$ 850,00              |
|                                          |
|  + Adicionar Gasto                       |
|                                          |
|  10/01/2025  Manutencao    R$ 350,00 [X] |
|  15/01/2025  Seguro        R$ 500,00 [X] |
+------------------------------------------+
```

## Etapas de Implementacao

### 1. Criar Tabela no Banco de Dados

Nova tabela `contract_expenses`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Primary key |
| contract_id | uuid | FK para contracts |
| user_id | uuid | FK para usuario |
| amount | numeric | Valor do gasto |
| expense_date | date | Data do gasto |
| category | text | Categoria (manutencao, seguro, ipva, multa, combustivel, outros) |
| description | text | Descricao detalhada |
| created_at | timestamp | Data de criacao |

Politicas RLS seguindo o padrao existente (usuarios verem/editarem apenas seus dados).

### 2. Criar Hook useContractExpenses

Novo arquivo `src/hooks/useContractExpenses.ts`:
- Query para buscar gastos de um contrato
- Query para buscar todos os gastos do usuario (para calcular totais)
- Mutation para criar gasto
- Mutation para deletar gasto
- Funcao para calcular total de gastos por contrato

### 3. Criar Componente ContractExpensesDialog

Novo arquivo `src/components/ContractExpensesDialog.tsx`:
- Dialog com lista de gastos do contrato
- Formulario para adicionar novo gasto
- Categorias pre-definidas: Manutencao, Seguro, IPVA, Multa, Combustivel, Pecas, Outros
- Resumo de gastos por categoria
- Botao para deletar gasto

### 4. Atualizar Card de Contrato (ProductSales.tsx)

Para contratos do tipo `aluguel_veiculo`:
- Adicionar secao de "Gastos" e "Lucro Liquido"
- Calcular: Lucro = Total Recebido - Total de Gastos
- Adicionar botao "Gastos" que abre o dialog

## Detalhes Tecnicos

### Estrutura da Tabela contract_expenses

```sql
CREATE TABLE contract_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'outros',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE contract_expenses ENABLE ROW LEVEL SECURITY;

-- Users can manage own expenses
CREATE POLICY "Users can manage own contract expenses"
ON contract_expenses FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Employees can manage owner expenses
CREATE POLICY "Employees can manage owner contract expenses"
ON contract_expenses FOR ALL
USING (user_id = get_employee_owner_id(auth.uid()));
```

### Categorias de Gastos

| Categoria | Label | Icone |
|-----------|-------|-------|
| manutencao | Manutencao | Wrench |
| seguro | Seguro | Shield |
| ipva | IPVA | FileText |
| multa | Multa | AlertTriangle |
| combustivel | Combustivel | Fuel |
| pecas | Pecas | Cog |
| documentacao | Documentacao | File |
| outros | Outros | MoreHorizontal |

### Interface do Componente

```typescript
interface ContractExpense {
  id: string;
  contract_id: string;
  user_id: string;
  amount: number;
  expense_date: string;
  category: string;
  description: string | null;
  created_at: string;
}

interface ContractExpensesDialogProps {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

### Calculo de Lucro no Card

```typescript
// Para cada contrato de veiculo:
const totalReceived = payments.filter(p => p.status === 'paid')
  .reduce((sum, p) => sum + p.amount, 0);
const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
const netProfit = totalReceived - totalExpenses;
```

## Arquivos a Criar

1. `src/hooks/useContractExpenses.ts` - Hook para gerenciar gastos
2. `src/components/ContractExpensesDialog.tsx` - Dialog de gastos

## Arquivos a Modificar

1. `src/pages/ProductSales.tsx` - Adicionar botao e exibicao de lucro/gastos no card
2. `src/hooks/useContracts.ts` - Exportar tipo Contract (se necessario)

## Migracao de Banco de Dados

1. Criar tabela `contract_expenses`
2. Adicionar foreign key para `contracts`
3. Criar politicas RLS
4. Adicionar indice em `contract_id` para performance

## Resultado Esperado

O usuario podera:
1. Ver no card do veiculo alugado: gastos totais e lucro liquido
2. Clicar em "Gastos" para abrir dialog detalhado
3. Adicionar gastos com categoria, valor, data e descricao
4. Ver resumo por categoria (quanto gastou em manutencao, seguro, etc)
5. Deletar gastos registrados incorretamente
6. Acompanhar a lucratividade real de cada veiculo

## Consideracoes de UX

- Cores: Gastos em vermelho/laranja, Lucro em verde (positivo) ou vermelho (negativo)
- O botao "Gastos" fica visivel apenas para contratos do tipo `aluguel_veiculo`
- Dialog responsivo com scroll para muitos gastos
- Confirmacao antes de deletar um gasto
