
# Agrupar Relatorio de Recebimentos por Tipo de Emprestimo

## Problema Atual
O PDF de recebimentos lista todos os pagamentos em uma unica tabela sem distincao. O usuario nao consegue ver rapidamente quanto recebeu de emprestimos diarios vs mensais vs semanais.

## Solucao
Agrupar os pagamentos no PDF por tipo de emprestimo (Diario, Semanal, Quinzenal, Mensal, Unico), cada grupo com seu proprio subtotal e ordenado por data.

## Alteracoes

### 1. Incluir `payment_type` do emprestimo na query (`src/components/PaymentsHistoryTab.tsx`)
- Alterar o select da query para incluir `payment_type` do emprestimo:
  `loans!inner ( client_id, payment_type, clients!inner ( full_name ) )`
- Mapear o campo `loan_payment_type` no objeto PaymentRecord

### 2. Expandir a interface `PaymentRecord` (`src/components/payments/PaymentsTable.tsx`)
- Adicionar campo opcional `loan_payment_type?: string` ao PaymentRecord para carregar o tipo do emprestimo (daily, weekly, biweekly, installment, single)

### 3. Reescrever a geracao do PDF (`src/lib/paymentsReportPdf.ts`)
- Agrupar os pagamentos por `loan_payment_type` na ordem: Diario, Semanal, Quinzenal, Mensal, Unico
- Para cada grupo:
  - Desenhar um cabecalho de secao com nome do grupo (ex: "EMPRESTIMOS DIARIOS") e cor de destaque
  - Exibir subtotais do grupo (total recebido, juros, principal, quantidade)
  - Listar pagamentos ordenados por data (mais antigo primeiro dentro do grupo)
  - Linha de subtotal ao final do grupo
- Manter o resumo consolidado no topo (como ja existe)
- Manter o total geral no rodape

## Secao Tecnica

### Arquivos modificados:
1. `src/components/payments/PaymentsTable.tsx` - Adicionar `loan_payment_type` ao interface PaymentRecord
2. `src/components/PaymentsHistoryTab.tsx` - Incluir `payment_type` do loan na query e mapear para `loan_payment_type`
3. `src/lib/paymentsReportPdf.ts` - Logica de agrupamento e renderizacao por secao no PDF

### Mapeamento de labels:
- `daily` -> "Emprestimos Diarios"
- `weekly` -> "Emprestimos Semanais"
- `biweekly` -> "Emprestimos Quinzenais"
- `installment` -> "Emprestimos Mensais"
- `single` -> "Emprestimos Parcela Unica"

### Estrutura do PDF:
```text
+------------------------------------------+
|  HEADER (logo + empresa + data)          |
+------------------------------------------+
|  RESUMO GERAL (4 cards consolidados)     |
+------------------------------------------+
|                                          |
|  === EMPRESTIMOS DIARIOS (15) ===        |
|  Subtotal: R$ X | Juros: R$ Y           |
|  Data | Cliente | Parcela | Tipo | Valor |
|  ...rows ordenados por data...           |
|  Total Diario: R$ X.XXX                  |
|                                          |
|  === EMPRESTIMOS SEMANAIS (8) ===        |
|  Subtotal: R$ X | Juros: R$ Y           |
|  ...                                     |
|                                          |
|  === EMPRESTIMOS MENSAIS (3) ===         |
|  ...                                     |
|                                          |
+------------------------------------------+
|  TOTAL GERAL: R$ X.XXX em N pagamentos   |
+------------------------------------------+
```

Nenhuma alteracao de banco de dados necessaria. Os dados ja existem na tabela `loans.payment_type`.
