
# Plano: Corrigir Exibicao de Contratos com Juros Historicos

## Problemas Identificados

Com base na imagem e na analise do codigo, os seguintes problemas foram encontrados:

### 1. Card mostrando "Atrasado" incorretamente
O emprestimo esta aparecendo como atrasado porque a primeira parcela nao paga esta no passado (30/01/2025). Porem, para contratos com juros historicos, isso e esperado - os juros JA foram pagos, e o principal deve vencer HOJE.

### 2. Data de vencimento mostrando 30/01/2025
O campo "Venc:" mostra a data da primeira parcela do array `installment_dates`, que e a data de inicio do emprestimo antigo. Deveria mostrar a proxima data de vencimento real (hoje: 30/01/2026).

### 3. Card deveria ser roxo
Contratos com `[HISTORICAL_INTEREST_CONTRACT]` deveriam ter estilo roxo para indicar que sao contratos especiais com juros historicos ja recebidos, similar aos contratos de "So Juros".

## Causa Raiz

Quando o usuario cria um emprestimo historico com juros:
- O sistema registra pagamentos de juros para cada parcela passada com `[INTEREST_ONLY_PAYMENT]`
- Porem, o `installment_dates` ainda contem apenas as datas do passado
- O `due_date` e definido como a ultima data do passado
- O sistema considera o emprestimo em atraso porque a proxima data nao paga esta no passado

## Solucao

### Alteracao 1: Adicionar data atual ao installment_dates

Quando criar um contrato com juros historicos, alem das datas passadas (para registro), adicionar a DATA ATUAL como a proxima parcela de vencimento do principal.

```typescript
// Apos registrar todos os juros historicos
// Atualizar o emprestimo para ter vencimento HOJE
await supabase.from('loans').update({
  due_date: format(new Date(), 'yyyy-MM-dd'),
  installment_dates: [...datasHistoricas, format(new Date(), 'yyyy-MM-dd')]
}).eq('id', loanId);
```

### Alteracao 2: Card roxo para contratos historicos

Adicionar verificacao em `getCardStyle()`:

```typescript
// Adicionar apos a verificacao de isInterestOnlyPayment
const isHistoricalInterestContract = loan.notes?.includes('[HISTORICAL_INTEREST_CONTRACT]');
if (isHistoricalInterestContract && !isOverdue && !isPaid) {
  return 'bg-purple-500/20 border-purple-400 dark:bg-purple-500/30 dark:border-purple-400';
}
```

### Alteracao 3: Logica de vencimento para contratos historicos

O campo "Venc:" deve mostrar a proxima data NAO PAGA que seja hoje ou no futuro:

```typescript
// No calculo do Venc:
const dates = (loan.installment_dates as string[]) || [];
const paidCount = getPaidInstallmentsCount(loan);
const today = format(new Date(), 'yyyy-MM-dd');

// Encontrar proxima data nao paga >= hoje
const nextDueDate = dates.slice(paidCount).find(d => d >= today) || dates[paidCount] || loan.due_date;
```

### Alteracao 4: Nao mostrar "Atrasado" se tem juros historicos e vencimento e hoje

Na funcao `getLoanStatus()`, para contratos `[HISTORICAL_INTEREST_CONTRACT]`:
- Se os juros historicos foram pagos (verificar pelo numero de pagamentos de juros)
- E a proxima data de vencimento e HOJE ou no futuro
- Entao NAO marcar como atrasado

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Loans.tsx` | handleSubmit/handleDailySubmit - adicionar data atual ao installment_dates |
| `src/pages/Loans.tsx` | getCardStyle() - adicionar estilo roxo para HISTORICAL_INTEREST_CONTRACT |
| `src/pages/Loans.tsx` | getLoanStatus() - ajustar logica de atraso para contratos historicos |
| `src/pages/Loans.tsx` | Display de "Venc:" - mostrar proxima data valida |

## Resultado Esperado

Apos as alteracoes, o card do emprestimo devera mostrar:

- **Cor**: Roxo (bg-purple-500/20) indicando contrato com juros historicos
- **Badge**: "📜 JUROS ANTIGOS" (ja existe)
- **Status**: "Pendente" ou "Vence Hoje" (NAO "Atrasado")
- **Venc**: 30/01/2026 (data atual, nao a data de inicio)
- **Restante a Receber**: R$ 1.100,00 (principal + 1 mes de juros)
- **Lucro Realizado**: R$ 1.300,00 (juros historicos ja recebidos)

## Complexidade

- **Estimativa**: Media
- **Linhas de codigo**: ~80-100
- **Risco**: Baixo (ajuste de logica de exibicao)

## Testes Recomendados

1. Criar emprestimo com data inicio 12 meses atras, selecionar todos os juros historicos
2. Verificar que o card fica ROXO (nao vermelho)
3. Verificar que "Venc:" mostra a data de HOJE
4. Verificar que NAO aparece badge "Atrasado"
5. Verificar que o restante a receber mostra o valor correto (principal + juros do periodo atual)
