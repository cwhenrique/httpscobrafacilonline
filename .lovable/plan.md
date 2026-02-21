
# Corrigir calculo de "A Cobrar Hoje" para considerar pagamentos parciais

## Problema
Quando um usuario registra um pagamento parcial (ex: paga R$ 60 de uma parcela de R$ 100), o card "A Cobrar Hoje" continua mostrando o valor total da parcela (R$ 100) ao inves do valor restante (R$ 40). Isso acontece porque o calculo ignora pagamentos parciais ja feitos.

## Causa
No arquivo `src/pages/Loans.tsx`, na area do "Resumo do Dia" (linha ~10243), o codigo adiciona o valor completo da parcela (`dailyInstallmentAmount`) ao total "A Cobrar Hoje" sem subtrair o valor ja pago parcialmente. A variavel `partialPayments` ja e calculada na linha 10235 mas nunca e utilizada nesse trecho.

## Solucao
Alterar o calculo de "A Cobrar Hoje" para subtrair o valor ja pago parcialmente de cada parcela que vence hoje.

### Arquivo: `src/pages/Loans.tsx` (linha ~10242-10246)

**Antes:**
```typescript
if (nextDueDate.getTime() === today.getTime()) {
  dueToday += dailyInstallmentAmount;
  profitTodayExpected += profitPerInstallment;
  dueTodayCount++;
}
```

**Depois:**
```typescript
if (nextDueDate.getTime() === today.getTime()) {
  const alreadyPaidPartial = partialPayments[paidCount] || 0;
  const remainingDue = Math.max(0, dailyInstallmentAmount - alreadyPaidPartial);
  dueToday += remainingDue;
  // Lucro esperado proporcional ao que falta cobrar
  const ratio = dailyInstallmentAmount > 0 ? remainingDue / dailyInstallmentAmount : 0;
  profitTodayExpected += profitPerInstallment * ratio;
  dueTodayCount++;
}
```

## Secao tecnica

- Unico arquivo modificado: `src/pages/Loans.tsx`
- A variavel `partialPayments` (linha 10235) ja contem o mapeamento `indice -> valor_pago` extraido das notas do emprestimo
- `paidCount` (linha 10233) retorna o indice da proxima parcela nao paga, que e exatamente o indice a consultar em `partialPayments`
- Nenhuma alteracao de banco de dados necessaria
