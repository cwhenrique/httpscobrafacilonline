
# Adicionar Status das Parcelas na Mensagem "Vence Hoje"

## Problema
A mensagem de cobranca "Vence Hoje" para emprestimos mensais nao inclui a lista de status das parcelas (Paga/Em Aberto/Em Atraso) porque os dados `installmentDates`, `paidCount` e `paidIndices` nao estao sendo passados nos componentes `SendDueTodayNotification` dentro das secoes "Due Today" da pagina de emprestimos.

Os botoes de emprestimos diarios ja passam esses dados corretamente (linhas ~9448-9450 e ~11616-11618), mas os botoes da secao "Vence Hoje" para emprestimos mensais/semanais (linhas ~9495-9524 e ~11647-11664) nao incluem essas propriedades.

## Solucao

### Arquivo: `src/pages/Loans.tsx`

Adicionar as propriedades `installmentDates`, `paidCount` e `paidIndices` em **4 locais** onde `SendDueTodayNotification` e chamado sem esses dados:

1. **Linha ~9507** (secao "Due Today" - card view, tema claro): adicionar apos `isDaily`:
   - `installmentDates: (loan.installment_dates as string[]) || []`
   - `paidCount: getPaidInstallmentsCount(loan)`
   - `paidIndices: getPaidIndicesFromNotes(loan)`

2. **Linha ~11663** (secao "Due Today" - list view, tema escuro): mesma adicao

### Arquivo: `src/lib/messageUtils.ts`

Ajustar `generateInstallmentStatusList` para limitar a 20 parcelas no maximo (evitar mensagens muito longas para emprestimos com muitas parcelas):
- Se `installmentDates.length > 20`: nao gerar lista (retornar string vazia)
- Isso garante que a lista so aparece para emprestimos com ate 20 parcelas, como solicitado

## Resultado Esperado
A mensagem passara a incluir o bloco:

```
STATUS DAS PARCELAS:
1 - 02/02/2026 - Paga
2 - 09/02/2026 - Paga
3 - 18/02/2026 - Em Aberto
4 - 25/02/2026 - Em Aberto
5 - 02/03/2026 - Em Aberto
```

## Resumo
- 1 arquivo principal modificado: `src/pages/Loans.tsx` (2 locais)
- 1 arquivo auxiliar: `src/lib/messageUtils.ts` (limite de 20 parcelas)
- Sem alteracao de banco de dados
