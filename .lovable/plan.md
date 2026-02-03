
# Plano: Registro de Pagamentos em Nova Aba

## Visao Geral

Criar uma nova aba "Recebimentos" na pagina de Emprestimos que exibe um historico completo de todos os pagamentos registrados. O usuario podera filtrar por periodo (Hoje, Esta Semana, Este Mes) ou selecionar um intervalo customizado de datas.

## Estrutura da Solucao

```text
+------------------------------------------+
|  Emprestimos | Diario | Price | Recebim. |
+------------------------------------------+
|                                          |
|  [Filtro de Periodo]                     |
|  [ Hoje ] [ Semana ] [ Mes ] [Periodo]   |
|                                          |
|  Resumo do Periodo:                      |
|  +----------------+  +----------------+  |
|  | Total Recebido |  | Juros Recebido |  |
|  | R$ 5.200,00    |  | R$ 1.800,00    |  |
|  +----------------+  +----------------+  |
|                                          |
|  Lista de Pagamentos:                    |
|  +--------------------------------------+|
|  | Data | Cliente | Valor | Tipo       ||
|  | 03/02 | Joao    | R$500 | Parcela 2/5||
|  | 03/02 | Maria   | R$300 | So Juros   ||
|  | ...                                  ||
|  +--------------------------------------+|
+------------------------------------------+
```

## Etapas de Implementacao

### 1. Criar Componente PaymentsHistoryTab

Novo arquivo `src/components/PaymentsHistoryTab.tsx`:
- Filtros de periodo: Hoje, Esta Semana, Este Mes, Personalizado
- Cards de resumo: Total Recebido, Juros Recebidos, Principal Pago, Quantidade
- Tabela/Lista de pagamentos com detalhes
- Carregamento dos dados via hook existente `useAllPayments`

### 2. Atualizar Hook useAllPayments

Modificar `src/hooks/useAllPayments.ts`:
- Adicionar parametros de filtro por data (startDate, endDate)
- Incluir join com tabela `loans` para buscar nome do cliente
- Aumentar limite para suportar consultas maiores

### 3. Integrar na Pagina Loans.tsx

Modificar `src/pages/Loans.tsx`:
- Expandir tipo de activeTab para incluir 'payments'
- Adicionar nova TabsTrigger na TabsList
- Criar TabsContent para a aba de recebimentos

### 4. Categorizar Tipos de Pagamento

Identificar tipo de pagamento pelas tags no campo notes:
- `[INTEREST_ONLY_PAYMENT]` = Pagamento de Juros
- `[PARTIAL_INTEREST_PAYMENT]` = Juros Parcial
- `[AMORTIZATION]` = Amortizacao
- `Parcela X de Y` = Quitacao de Parcela
- Sem tag especial = Pagamento Normal

## Detalhes Tecnicos

### Estrutura de Dados (loan_payments)

| Campo | Tipo | Uso |
|-------|------|-----|
| payment_date | date | Data do pagamento (filtro) |
| amount | numeric | Valor total pago |
| principal_paid | numeric | Valor abatido do principal |
| interest_paid | numeric | Valor de juros |
| notes | text | Tipo do pagamento (tags) |
| loan_id | uuid | FK para buscar cliente |

### Query para Buscar Pagamentos com Cliente

```sql
SELECT 
  lp.*,
  l.client_id,
  c.full_name as client_name
FROM loan_payments lp
JOIN loans l ON l.id = lp.loan_id
JOIN clients c ON c.id = l.client_id
WHERE lp.payment_date BETWEEN :startDate AND :endDate
ORDER BY lp.payment_date DESC, lp.created_at DESC
```

### Componentes UI Utilizados

- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (existentes)
- `Card`, `CardContent`, `CardHeader` (existentes)
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` (existentes)
- `Button` para filtros de periodo
- `Popover` + `Calendar` para selecao de periodo customizado
- `Badge` para identificar tipo de pagamento

### Filtros de Periodo

| Filtro | Logica |
|--------|--------|
| Hoje | startOfDay(today) ate endOfDay(today) |
| Esta Semana | startOfWeek(today) ate endOfDay(today) |
| Este Mes | startOfMonth(today) ate endOfDay(today) |
| Personalizado | Calendario com selecao de intervalo |

## Interface do Componente

```typescript
interface PaymentRecord {
  id: string;
  loan_id: string;
  amount: number;
  principal_paid: number;
  interest_paid: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  client_name: string;
  payment_type: 'normal' | 'interest_only' | 'partial_interest' | 'amortization' | 'installment';
}
```

## Arquivos a Criar

1. `src/components/PaymentsHistoryTab.tsx` - Componente principal da aba

## Arquivos a Modificar

1. `src/hooks/useAllPayments.ts` - Adicionar filtros e join com cliente
2. `src/pages/Loans.tsx` - Adicionar nova aba ao sistema de tabs

## Resultado Esperado

O usuario podera:
1. Clicar na aba "Recebimentos" na pagina de Emprestimos
2. Ver todos os pagamentos do dia por padrao
3. Filtrar por Semana, Mes ou periodo customizado
4. Ver resumo com totais (valor recebido, juros, principal)
5. Ver lista detalhada com cliente, valor, tipo e data
6. Identificar visualmente cada tipo de pagamento (cores diferentes)
