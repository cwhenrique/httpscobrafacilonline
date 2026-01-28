
# Plano: Corrigir Pagamentos Parciais de Juros que Estão Reduzindo Valor da Parcela

## Problema

Quando o usuário registra pagamentos parciais de juros usando a nova funcionalidade, o valor da parcela está sendo reduzido incorretamente:

- **Screenshot mostra**: Parcela 1/1 com "Valor: R$ 1.200,00 | Pago: R$ 400,00 | Falta: R$ 800,00"
- **Comportamento esperado**: O valor de R$ 1.200 deveria permanecer intacto, com os R$ 400 mostrados apenas como "Juros já pago"

### Causa Raiz

1. **Fallback Logic**: O código de status da parcela (linhas 11265-11293 do Loans.tsx) tem uma lógica de fallback que usa `total_paid` para calcular quanto foi pago quando não existem tags `[PARTIAL_PAID]`

2. **Tag não reconhecida**: O fallback verifica apenas `[INTEREST_ONLY_PAYMENT]` mas NÃO verifica `[PARTIAL_INTEREST_PAYMENT]`

3. **Cálculo incorreto**: Quando há pagamentos parciais de juros, o `total_paid` inclui esses valores, e o fallback interpreta erroneamente como pagamento da parcela principal

## Solução

### Alteração no arquivo src/pages/Loans.tsx

#### 1. Corrigir a verificação de tags de pagamento de juros

Modificar a condição do fallback para também ignorar quando houver pagamentos parciais de juros:

Linha ~11268:
```typescript
// ANTES:
const hasInterestOnlyTag = (selectedLoan.notes || '').includes('[INTEREST_ONLY_PAYMENT]');

// DEPOIS:
const hasInterestOnlyTag = (selectedLoan.notes || '').includes('[INTEREST_ONLY_PAYMENT]');
const hasPartialInterestTag = (selectedLoan.notes || '').includes('[PARTIAL_INTEREST_PAYMENT]');
```

Linha ~11270:
```typescript
// ANTES:
if (!hasAnyTrackingTags && !hasInterestOnlyTag && selectedLoan.total_paid && selectedLoan.total_paid > 0) {

// DEPOIS:
if (!hasAnyTrackingTags && !hasInterestOnlyTag && !hasPartialInterestTag && selectedLoan.total_paid && selectedLoan.total_paid > 0) {
```

#### 2. Aplicar mesma correção em outras funções getInstallmentStatus

Existem múltiplas cópias da função `getInstallmentStatus` no arquivo. Todas precisam ser corrigidas:

- **getInstallmentStatusForDisplay** (~linha 8653): Usada nos cards de empréstimo
- **getInstallmentStatus** (~linha 11252): Usada no diálogo de pagamento
- **getInstallmentStatusPartial** (~linha 11664): Usada no pagamento parcial

Para cada uma, adicionar verificação de `[PARTIAL_INTEREST_PAYMENT]`.

#### 3. Garantir que o texto exibido seja claro

Quando há pagamentos parciais de juros para uma parcela, a exibição deveria mostrar:

- **Valor da Parcela**: R$ 1.200,00 (principal R$ 1.000 + juros R$ 200)
- **Juros já pago**: R$ 70 (verde)
- **Juros pendente**: R$ 130 (amarelo)
- **Principal a pagar**: R$ 1.000,00

A UI já mostra os pagamentos parciais de juros corretamente (código nas linhas 11424-11447), mas o problema é que a linha 11448-11451 está exibindo o status incorreto porque `status.paidAmount` e `status.remaining` estão errados.

## Seção Técnica

### Localizações das alterações

| Linha | Alteração |
|-------|-----------|
| ~11268 | Adicionar `const hasPartialInterestTag = ...` |
| ~11270 | Incluir `&& !hasPartialInterestTag` na condição |
| ~8653+ | Aplicar mesma correção se houver fallback |
| ~11664+ | Verificar se precisa da mesma correção |

### Verificar outros locais com lógica similar

Buscar por outros lugares que usam fallback baseado em `total_paid`:

```typescript
// Padrão a buscar:
if (!hasAnyTrackingTags && ... && selectedLoan.total_paid
```

### Fluxo Corrigido

```text
Empréstimo: R$ 1.000 principal + R$ 200 juros = R$ 1.200 total

Usuário paga R$ 70 de juros parcial
  -> [PARTIAL_INTEREST_PAYMENT] registrado
  -> [PARTIAL_INTEREST_PAID:0:70:data] adicionado
  -> total_paid = 70
  -> remaining_balance = 1.200 (NÃO MUDA - triggers corrigidos)

Ao abrir diálogo de pagamento:
  -> hasPartialInterestTag = true
  -> Fallback é IGNORADO
  -> partialPayments[0] = undefined (não há [PARTIAL_PAID])
  -> paidAmount = 0
  -> remaining = 1.200
  
Exibição:
  -> "Valor: R$ 1.200,00" (correto)
  -> "Juros já pago: R$ 70" (do breakdown de juros parciais)
  -> "Juros pendente: R$ 130" (do breakdown)
```

### Validação

Após a correção:
1. Criar empréstimo de R$ 1.000 + 20% juros = R$ 1.200
2. Usar "Pagamento parcial de juros" para pagar R$ 70
3. Abrir diálogo de pagamento normal
4. Verificar que mostra "Valor: R$ 1.200" sem redução
5. Verificar que mostra "Juros já pago: R$ 70" na seção de breakdown
