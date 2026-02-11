

## Ajuste: "Em Atraso" filtrado pelo periodo selecionado

### Problema
Atualmente, o valor e a quantidade de contratos "Em Atraso" no relatorio de emprestimos mostram dados fixos de todo o portfolio, ignorando o filtro de periodo (mes, semana, etc). Isso dificulta a analise mensal.

### O que muda
- O card "Em Atraso" (valor e quantidade) passara a considerar apenas emprestimos criados dentro do periodo selecionado no filtro
- A tabela de atrasados ja filtra corretamente, entao nao precisa de ajuste
- O grafico de barras que mostra "Atraso" tambem sera atualizado automaticamente

### Mudanca tecnica

**Arquivo:** `src/pages/ReportsLoans.tsx`

No calculo de `filteredStats` (linha ~460-637), as variaveis de atraso atualmente usam `loansFilteredByType` (sem filtro de data). A mudanca e:

1. Calcular `overdueAmount` a partir de `overdueLoansInPeriod` (que ja existe e e filtrado por data) em vez de `allOverdueLoans`
2. Atualizar `overdueCount` para usar `overdueLoansInPeriod.length` em vez de `allOverdueLoans.length`

Isso alinha o card com a tabela, que ja funciona corretamente com o filtro de periodo.

