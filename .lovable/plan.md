

# Plano: Corrigir Sub-Parcela de Maria do Rosário

## Diagnóstico Confirmado

**Usuário:** Ray Dias (nadinbnd53@gmail.com)
**Cliente:** Maria do Rosário
**Empréstimo ID:** `0000e142-b05c-44a2-b775-c17200eaad65`

### Estado Atual das Notes

```
[OVERDUE_CONSOLIDATED:130.00:2026-01-20:13]
[OVERDUE_CONFIG:fixed:10]
[HISTORICAL_CONTRACT] 
[PARTIAL_PAID:0:1278] 
[PARTIAL_PAID:1:1278] 
[PARTIAL_PAID:2:1278] 
[PARTIAL_PAID:3:1278]
[PARTIAL_PAID:4:1278.00]
[ADVANCE_SUBPARCELA:4:478.00:2026-01-07:1768918367648]  ← Sub-parcela PENDENTE (deveria ser _PAID)
[PARTIAL_PAID:-1:1278.00]  ← Tag INVÁLIDA (índice -1)
```

### Problema

| Sintoma | Causa |
|---------|-------|
| Sub-parcela aparece como paga na tela de pagamento | Pagamento de R$ 1.278,00 foi registrado |
| Parcela 5 aparece em atraso | Tag `ADVANCE_SUBPARCELA` não foi renomeada para `_PAID` |
| Tag com índice -1 | Bug no código ao processar sub-parcela |

## Solução

### Parte 1: Correção de Dados (SQL)

Executar migração para corrigir as notes do empréstimo:

```sql
UPDATE loans 
SET notes = REPLACE(
  REPLACE(
    notes, 
    '[ADVANCE_SUBPARCELA:4:478.00:2026-01-07:1768918367648]', 
    '[ADVANCE_SUBPARCELA_PAID:4:478.00:2026-01-07:1768918367648]'
  ),
  '[PARTIAL_PAID:-1:1278.00]', 
  ''
)
WHERE id = '0000e142-b05c-44a2-b775-c17200eaad65';
```

**Resultado esperado das notes:**
```
[OVERDUE_CONSOLIDATED:130.00:2026-01-20:13]
[OVERDUE_CONFIG:fixed:10]
[HISTORICAL_CONTRACT] 
[PARTIAL_PAID:0:1278] 
[PARTIAL_PAID:1:1278] 
[PARTIAL_PAID:2:1278] 
[PARTIAL_PAID:3:1278]
[PARTIAL_PAID:4:1278.00]
[ADVANCE_SUBPARCELA_PAID:4:478.00:2026-01-07:1768918367648]  ← Agora marcada como PAGA
```

### Parte 2: Correção Preventiva no Código

**Arquivo:** `src/pages/Loans.tsx`

#### Alteração 1: Buscar dados frescos antes de processar pagamento

No início de `handlePaymentSubmit`, buscar dados atualizados do empréstimo para evitar race conditions.

#### Alteração 2: Validar se sub-parcela existe

Quando `isAdvanceSubparcelaPayment` é `true`, verificar se `targetSubparcela` foi encontrada. Se não, exibir erro e abortar.

#### Alteração 3: Bloquear índice negativo

Adicionar validação para impedir que `targetInstallmentIndex` seja negativo no bloco de pagamento parcial.

## Arquivos Afetados

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| Migração SQL | Corrigir dados do empréstimo específico |
| src/pages/Loans.tsx | Adicionar validações preventivas |

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Sub-parcela mostra pendente | Sub-parcela mostra como paga |
| Parcela 5 em atraso | Parcela 5 com status correto |
| Tags inválidas nas notes | Notes limpas e consistentes |

