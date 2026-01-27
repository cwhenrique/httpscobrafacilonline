

# Corrigir "Juros a Receber" para Filtrar por Período

## Problema Identificado

Ao filtrar por um período de 4 meses (janeiro a abril), o empréstimo de R$ 10.000 com parcela em 27/03 não mostra os R$ 2.000 de juros a receber porque:

1. **O cálculo atual de "Juros a Receber" usa CURRENT STATE** - mostra todos os juros pendentes independente do período
2. **Não considera as datas de vencimento das parcelas** - deveria mostrar apenas juros de parcelas que vencem no período selecionado

### Dados do empréstimo:
- Principal: R$ 10.000
- Juros: R$ 2.000 (20%)
- Data de vencimento: 27/03/2026
- Período filtrado: ~4 meses (jan-abr)

## Solução

Modificar o cálculo de `pendingInterest` para filtrar por período quando um período está selecionado, similar ao que já é feito com `pendingAmount`.

## Alterações Necessárias

### Arquivo: `src/pages/ReportsLoans.tsx`

**Linhas 463-487** - Modificar cálculo de `pendingInterest`:

A lógica será alterada para:

1. **Calcular juros por parcela** baseado no modo de juros (per_installment ou on_total)
2. **Verificar cada data de vencimento** contra o período selecionado usando `parseISO` e `isWithinInterval`
3. **Somar apenas juros de parcelas que vencem no período**
4. **Manter comportamento atual** quando nenhum período está selecionado

```text
+------------------+     +--------------------+     +------------------+
|  Para cada loan  | --> | Calcular juros/    | --> | Se tem período:  |
|  ativo           |     | parcela            |     | filtrar por data |
+------------------+     +--------------------+     +------------------+
                                                            |
                                                            v
                                               +------------------------+
                                               | Somar juros das        |
                                               | parcelas no período    |
                                               +------------------------+
```

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Juros a Receber (4 meses) | R$ 0 | R$ 2.000 |
| Parcela 27/03 | Não contabilizada | Contabilizada |

O empréstimo de R$ 10.000 com parcela em 27/03 passará a mostrar os R$ 2.000 de juros a receber quando o período de 4 meses for selecionado.

## Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `src/pages/ReportsLoans.tsx` | Modificar cálculo de `pendingInterest` para filtrar por datas de vencimento |

