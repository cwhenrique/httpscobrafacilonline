

# Plano: Card Continua Roxo Após Rolar o Mês

## Problema

Quando os juros parciais são totalmente pagos, o sistema:
1. Remove as tags `[PARTIAL_INTEREST_PAID:]` e `[PARTIAL_INTEREST_PENDING:]`
2. Adiciona a tag `[INTEREST_CLEARED:]` para registrar que os juros foram quitados
3. Rola o contrato para o próximo mês

O card perde a cor roxa porque a detecção atual (linha 7300-7302) só procura por:
- `[PARTIAL_INTEREST_PAID:]`
- `[PARTIAL_INTEREST_PENDING:]`

Mas **não** procura por `[INTEREST_CLEARED:]` que permanece no histórico.

---

## Solução

Adicionar `[INTEREST_CLEARED:]` na detecção de `hasPartialInterestPayments` para que o card continue roxo mesmo após o rollover.

### Alteração no arquivo src/pages/Loans.tsx

**Linha ~7300-7302 - Antes:**
```typescript
const hasPartialInterestPayments = 
  (loan.notes || '').includes('[PARTIAL_INTEREST_PAID:') ||
  (loan.notes || '').includes('[PARTIAL_INTEREST_PENDING:');
```

**Depois:**
```typescript
const hasPartialInterestPayments = 
  (loan.notes || '').includes('[PARTIAL_INTEREST_PAID:') ||
  (loan.notes || '').includes('[PARTIAL_INTEREST_PENDING:') ||
  (loan.notes || '').includes('[INTEREST_CLEARED:');
```

---

## Fluxo Visual

```text
Estado 1: Pagamento parcial feito (R$ 70 de R$ 200)
Tags: [PARTIAL_INTEREST_PAID:0:70:2026-01-28]
      [PARTIAL_INTEREST_PENDING:0:130:2026-02-28]
Card: ROXO ✓

Estado 2: Juros restantes pagos (R$ 130)
Tags antigas removidas, nova tag adicionada:
      [INTEREST_CLEARED:0:2026-01-28]
Card: ROXO ✓ (continua roxo por causa do INTEREST_CLEARED)

Estado 3: Próximo mês, novo pagamento parcial
Tags: [INTEREST_CLEARED:0:2026-01-28]
      [PARTIAL_INTEREST_PAID:1:50:2026-02-15]
Card: ROXO ✓
```

---

## Resultado Esperado

| Situação | Cor do Card |
|----------|-------------|
| Pagamento parcial de juros ativo | **Roxo** |
| Juros quitados, contrato rolou | **Roxo** (histórico de interest-only) |
| Múltiplos meses de juros-only | **Roxo** (acumula tags CLEARED) |

---

## Resumo

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| src/pages/Loans.tsx | ~7300-7302 | Adicionar `[INTEREST_CLEARED:]` na detecção |

