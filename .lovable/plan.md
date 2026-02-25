

# Correção: Multas/Penalidades devem entrar como Lucro nos Relatórios

## Problema

Quando um pagamento inclui multa (tag `[PENALTY_INCLUDED:X.XX]`), esse valor **não é contabilizado como lucro**. O lucro é calculado exclusivamente a partir de `interest_paid`, que não inclui a multa.

Exemplo real do banco:
- Pagamento de R$ 480 → `interest_paid: 180` + `[PENALTY_INCLUDED:40.00]`
- O lucro registrado é R$ 180, mas deveria ser **R$ 220** (juros + multa)

## Onde o lucro é calculado

1. **`src/pages/ReportsLoans.tsx` (linha 405, 631)** — `realizedProfit` usa apenas `sum(interest_paid)`
2. **`src/pages/ReportsLoans.tsx` (linhas 454-467)** — `paymentsInPeriod` extrai `interestPaid` sem somar penalty
3. **`src/hooks/useDashboardStats.ts`** — `pending_interest` na função RPC não considera penalties pagas
4. **Evolução mensal (linha 760)** — `lucro = recebido - principal` (este já captura indiretamente, pois `amount` inclui penalty)

## Solução

### 1. `src/pages/ReportsLoans.tsx` — Extrair penalty das notas e somar ao lucro

Em todos os locais que constroem objetos de pagamento (linhas ~298, ~454, ~463), adicionar extração da tag `[PENALTY_INCLUDED]` e somar ao `interestPaid`:

```typescript
const getPenaltyFromNotes = (notes: string | null): number => {
  const match = (notes || '').match(/\[PENALTY_INCLUDED:([0-9.]+)\]/);
  return match ? parseFloat(match[1]) : 0;
};

// Onde se constrói payment objects:
interestPaid: Number(p.interest_paid || 0) + getPenaltyFromNotes(p.notes),
```

Isso corrige automaticamente:
- `realizedProfitInPeriod` (linha 631)
- Lucro por tipo de pagamento (linha 405)
- Cards de "Lucro Realizado"
- Tabelas de pagamentos

### 2. `src/hooks/useDashboardStats.ts` — Incluir penalties pagas no totalOverdueInterest

O cálculo de `totalToReceive` já soma multas pendentes via `calculateDynamicOverdueInterest`. Nenhuma alteração necessária aqui — o dashboard mostra o que FALTA receber (incluindo multas), não o lucro realizado.

### 3. `src/hooks/useOperationalStats.ts` — Verificar se lucro operacional inclui penalties

Verificar se o hook usado pelo ReportsLoans também precisa da mesma correção no mapeamento de pagamentos.

## Resumo

| Arquivo | Alteração |
|---|---|
| `src/pages/ReportsLoans.tsx` | Adicionar helper `getPenaltyFromNotes()` e somar penalty ao `interestPaid` em todos os mapeamentos de pagamentos (~3 locais) |
| Nenhuma migração necessária | Os dados já contêm `[PENALTY_INCLUDED:X.XX]` nas notas — basta extrair |

