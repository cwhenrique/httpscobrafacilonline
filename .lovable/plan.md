

# Correcao: Cards de Resumo Diario Mostrando Valores Reais

## Problema

Os cards "A Cobrar Hoje", "Lucro do Dia" e "Recebido Hoje" na aba "Diario" mostram R$ 0,00 mesmo quando existem parcelas vencendo hoje. A causa raiz esta na logica de calculo (linhas 10460-10473 de `Loans.tsx`):

```text
O codigo busca apenas a parcela no indice `paidCount` (proxima nao paga).
Se o cliente tem parcelas ATRASADAS de dias anteriores, `paidCount` aponta
para essas parcelas antigas, NAO para a de hoje.

Exemplo: Cliente com 10 parcelas diarias, pagou 3, esta no dia 7.
- paidCount = 3 (parcela 4 e a proxima nao paga)
- dates[3] = dia 4 (atrasada, nao e hoje)
- Resultado: "A Cobrar Hoje" = R$ 0,00 (ERRADO)
```

## Solucao

### Arquivo: `src/pages/Loans.tsx` (linhas 10449-10491)

Reescrever a logica de calculo do "A Cobrar Hoje" para verificar TODAS as parcelas do emprestimo, nao apenas a proxima nao paga. Para cada parcela:

1. Verificar se a data da parcela e HOJE
2. Verificar se a parcela ainda nao foi paga (usando `partialPayments`)
3. Se sim, somar o valor restante ao total "A Cobrar Hoje"

A logica corrigida:

```text
Para cada emprestimo diario ativo:
  Para cada parcela (i) no array installment_dates:
    Se date[i] == hoje:
      paidAmount = partialPayments[i] ou 0
      Se paidAmount < installmentValue * 0.99:
        dueToday += max(0, installmentValue - paidAmount)
        dueTodayCount++
        profitTodayExpected += profitPerInstallment * ratio
```

Isso garante que mesmo clientes com parcelas atrasadas de dias anteriores tenham sua parcela de hoje contabilizada corretamente.

### Nenhuma alteracao nos outros cards

- **"Lucro do Dia"** e **"Recebido Hoje"**: Ja usam `payment_date === todayStr` dos `loan_payments`, entao so mostram R$ 0,00 se realmente nao houve pagamentos hoje. Esses estao corretos.
- **"Em Atraso"**: Ja itera por todas as parcelas. Esta correto.

## Resultado Esperado

- "A Cobrar Hoje" mostrara o valor real das parcelas que vencem hoje, incluindo parcelas de clientes que tem atrasos em dias anteriores
- "Lucro do Dia" e "Recebido Hoje" continuam refletindo pagamentos reais do dia
- "Em Atraso" continua somando todas as parcelas vencidas nao pagas

