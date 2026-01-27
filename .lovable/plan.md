

# Adicionar Dois Cards de Juros nos Relatórios

## Objetivo

Separar a informação de juros em dois cards distintos para evitar confusão quando há pagamentos adiantados:

1. **Juros Pendentes**: Juros contratuais que AINDA NÃO foram pagos (saldo real)
2. **Juros no Período**: Juros das parcelas que VENCEM no período filtrado (agenda/previsão)

## Cenário Atual vs Esperado

| Métrica | Valor Atual | Valor Esperado |
|---------|-------------|----------------|
| Juros Pendentes | R$ 0,00 | R$ 0,00 (correto - você já recebeu) |
| Juros no Período | N/A | R$ 2.000 (parcela vence em 27/03) |

## Alterações Necessárias

### Arquivo: `src/pages/ReportsLoans.tsx`

**1. Adicionar novo cálculo `interestInPeriod` (após linha 538):**

Calcular os juros das parcelas que vencem no período, **independente de já terem sido pagos ou não**:

```typescript
// Juros das Parcelas no Período (agenda/previsão)
const interestScheduledInPeriod = allActiveLoans.reduce((sum, loan) => {
  // ...calcular interestPerInstallment igual ao pendingInterest...
  
  if (dateRange?.from && dateRange?.to && installmentDates.length > 0) {
    let scheduledInterest = 0;
    installmentDates.forEach((dateStr: string) => {
      const dueDate = parseISO(dateStr);
      if (isWithinInterval(dueDate, { start: startDate, end: endDate })) {
        // Incluir juros da parcela, MESMO SE JÁ PAGO
        scheduledInterest += interestPerInstallment;
      }
    });
    return sum + scheduledInterest;
  }
  return sum;
}, 0);
```

**2. Adicionar `interestScheduledInPeriod` ao retorno de `filteredStats` (linha ~641):**

```typescript
return {
  totalOnStreet,
  pendingInterest,        // Juros ainda não pagos
  interestScheduledInPeriod, // Juros das parcelas no período (agenda)
  // ...resto
};
```

**3. Modificar exibição dos cards (após linha ~1123):**

Substituir o card único de "Juros a Receber" por dois cards:

```tsx
{/* Card 1: Juros Pendentes (saldo real) */}
<StatCard
  label="💰 Juros Pendentes"
  value={formatCurrency(filteredStats.pendingInterest)}
  icon={TrendingUp}
  iconColor="text-primary"
  tooltip="Juros contratuais que ainda NÃO foram pagos"
/>

{/* Card 2: Juros no Período (agenda) */}
<StatCard
  label="📅 Juros no Período"
  value={formatCurrency(filteredStats.interestScheduledInPeriod)}
  icon={CalendarDays}
  iconColor="text-blue-500"
  tooltip="Juros das parcelas que vencem no período selecionado (mesmo que já pagos)"
/>
```

## Resultado Visual

O relatório passará a mostrar:

| Card | Valor | Significado |
|------|-------|-------------|
| Juros Pendentes | R$ 0,00 | O cliente já pagou os juros |
| Juros no Período | R$ 2.000 | Em março você tem R$ 2k de juros programados |

## Alternativa Simplificada

Se preferir manter apenas um card, podemos mostrar ambos os valores no mesmo card com um tooltip expandido:

```tsx
<StatCard
  label="💰 Juros a Receber"
  value={formatCurrency(filteredStats.pendingInterest)}
  secondaryValue={`Agenda: ${formatCurrency(filteredStats.interestScheduledInPeriod)}`}
  tooltip="Pendente: juros não pagos | Agenda: juros das parcelas no período"
/>
```

## Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `src/pages/ReportsLoans.tsx` | Adicionar cálculo de `interestScheduledInPeriod` e novo card |

## Notas Técnicas

A lógica atual de `pendingInterest` está correta: ela calcula juros ainda NÃO pagos. O problema é que faltava uma métrica separada para mostrar "o que vence no período" (independente de pagamento).

