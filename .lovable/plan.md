

# Diagnóstico: Saldo incorreto no empréstimo de Sarona Ketlen

## Problema identificado

O empréstimo `c8de9345` (4 parcelas de R$ 123, total R$ 492) tem `remaining_balance = 33` quando deveria ser **123** (1 parcela restante).

**O que aconteceu:**

```text
Parcela 1: R$ 123 → paga ✓ (nota: [CONTRATO_ANTIGO])
Parcela 2: R$ 123 + R$ 60 multa = R$ 183 → paga ✓ (90 + 93)
Parcela 3: R$ 123 + R$ 30 multa = R$ 153 → paga ✓
Parcela 4: R$ 123 → pendente

Total pago: R$ 459 | Falta: R$ 123
Porém o sistema mostra: remaining_balance = 33
```

**Causa raiz:** Os pagamentos das parcelas 2 e 3 incluíram multas (R$ 60 da `[OVERDUE_CONSOLIDATED]` e R$ 30 da `[DAILY_PENALTY:2:30]`), mas nenhum desses pagamentos recebeu a tag `[PENALTY_INCLUDED:X.XX]`. Sem essa tag, o trigger do banco tratou o valor total (incluindo multas) como abatimento do saldo, reduzindo `remaining_balance` em R$ 90 a mais do que deveria.

Dois bugs causam isso:
1. A multa `[OVERDUE_CONSOLIDATED]` não é convertida em `[DAILY_PENALTY]` por parcela quando o pagamento é feito via fluxo de pagamento parcial ou contratos antigos
2. Mesmo quando `[DAILY_PENALTY]` existe, o cálculo de `penaltyInPayment` pode falhar se o `payment_type` não bate com as condições esperadas (ex: pagamento parcial vs installment)

## Correções

### 1. Correção de dados — empréstimo Sarona Ketlen

Atualizar `remaining_balance` de 33 para 123 e limpar a tag `[DAILY_PENALTY:2:30.00]` (já paga):

```sql
UPDATE loans 
SET remaining_balance = 123,
    notes = REPLACE(notes, '[DAILY_PENALTY:2:30.00]' || E'\n', '')
WHERE id = 'c8de9345-2dd2-4422-b144-409359c221fa';
```

### 2. Correção de código — `src/pages/Loans.tsx`

No cálculo de `penaltyInPayment` (linhas ~5180-5200), adicionar detecção de multas consolidadas (`[OVERDUE_CONSOLIDATED]`) quando não existem tags `[DAILY_PENALTY]` individuais para as parcelas sendo pagas. Isso garante que a tag `[PENALTY_INCLUDED]` seja adicionada ao pagamento.

Lógica:
- Após calcular `penaltyInPayment` via `loanPenalties`, verificar se o valor do pagamento excede o valor base da parcela
- Se o excesso corresponder a uma multa consolidada conhecida, incluir na tag `[PENALTY_INCLUDED]`

### 3. Limpeza de tags pagas — `src/pages/Loans.tsx`

Após registrar pagamento com sucesso, remover as tags `[DAILY_PENALTY:X:Y]` das parcelas que acabaram de ser quitadas. Isso evita que multas já pagas continuem sendo exibidas como pendentes no frontend (que soma `getTotalDailyPenalties` ao `remaining_balance`).

## Resumo

| Item | Alteração |
|---|---|
| Banco de dados | Corrigir `remaining_balance` de 33 → 123; limpar tag de multa paga |
| `src/pages/Loans.tsx` | Incluir `[OVERDUE_CONSOLIDATED]` no cálculo de `penaltyInPayment`; limpar tags `[DAILY_PENALTY]` após pagamento |

