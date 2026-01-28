
## Objetivo
Quando você paga **juros parcial** (ex: R$ 70 de R$ 200), a tela de **Parcelas** não pode diminuir a parcela para R$ 1.130.  
O correto é:
- **Valor da parcela continua R$ 1.200**
- **Pago (da parcela)** continua **R$ 0** (porque não pagou principal/parcela ainda)
- Mostrar separado: **“Juros já pago: R$ 70”** e **“Juros pendente: R$ 130”**
- O **Restante do contrato** continua R$ 1.200 até quitar a parcela (ou até rolar quando quitar 100% dos juros, conforme regra já definida).

---

## Causa raiz (confirmada no código)
No `src/pages/Loans.tsx`, no diálogo/box de “Parcela”, existe um **fallback**:
- Se não tem tags `[PARTIAL_PAID]` no `loan.notes`, ele usa `selectedLoan.total_paid` para “inventar” quanto foi pago na parcela.
- O problema: no pagamento de juros parcial, o sistema **não grava** `[PARTIAL_INTEREST_PAYMENT]` dentro de `loan.notes` (essa tag fica no `loan_payments.notes`), então o fallback não detecta e interpreta `total_paid=70` como “pago da parcela”, reduzindo para 1130.

Hoje o código verifica:
```ts
const hasPartialInterestTag = (selectedLoan.notes || '').includes('[PARTIAL_INTEREST_PAYMENT]');
```
Mas como essa tag não está no `loan.notes`, `hasPartialInterestTag` fica falso.

---

## O que vou mudar (sem alterar regras financeiras, só o cálculo/visual)
### 1) Corrigir a detecção de “pagamento parcial de juros” no `loan.notes`
Em vez de procurar apenas `[PARTIAL_INTEREST_PAYMENT]`, vou considerar que existe tracking de juros parcial se o `notes` contiver qualquer um destes:
- `[PARTIAL_INTEREST_PAID:` (histórico do que já pagou)
- `[PARTIAL_INTEREST_PENDING:` (quanto falta de juros naquela parcela)
- `[INTEREST_CLEARED:` (quando quitou 100% dos juros por parcial e rolou)

Exemplo:
```ts
const hasPartialInterestTracking =
  notes.includes('[PARTIAL_INTEREST_PAID:') ||
  notes.includes('[PARTIAL_INTEREST_PENDING:') ||
  notes.includes('[INTEREST_CLEARED:') ||
  notes.includes('[PARTIAL_INTEREST_PAYMENT]'); // opcional (se existir em algum caso)
```

### 2) Bloquear o fallback de `total_paid` quando houver tracking de juros parcial
Na função `getInstallmentStatus` (do diálogo “Parcela”):
- Hoje ele bloqueia fallback só com `hasPartialInterestTag` (errado).
- Vou trocar para `hasPartialInterestTracking`.

Resultado:
- `paidAmount` da parcela permanece 0
- `remaining` permanece 1200
- E o box continua mostrando separadamente “Juros já pago” e “Juros pendente”.

### 3) Aplicar a mesma correção em todos os lugares equivalentes
O arquivo tem mais de uma função de status/visualização de parcelas (ex: `getInstallmentStatusForDisplay`, `getInstallmentStatusPartial`, e outros blocos similares).
Vou procurar por padrões como:
- `const hasInterestOnlyTag = ...`
- `if (!hasAnyTrackingTags && ... && selectedLoan.total_paid ... )`
e aplicar a mesma regra: **se houver tracking de juros parcial, não usar `total_paid` como pagamento da parcela**.

### 4) Evitar que contagens automáticas de parcelas pagas usem juros parcial por engano
Funções como `getPaidInstallmentsCount` também têm fallback baseado em `loan.total_paid`.
Vou acrescentar a mesma proteção lá:
- se existir `[PARTIAL_INTEREST_PAID:`/`[PARTIAL_INTEREST_PENDING:` no notes, **não considerar `total_paid` como pagamento de parcela** para “contar parcelas pagas”.

---

## Como vou validar (checklist)
1. Criar empréstimo 1 parcela: **R$ 1.000 + R$ 200 = R$ 1.200**
2. Fazer pagamento **juros parcial**: R$ 70
3. Abrir o modal de pagamento → opção **Parcela**
4. Verificar:
   - “Valor: R$ 1.200”
   - “Pago: R$ 0”
   - “Falta: R$ 1.200”
   - E abaixo: “Juros já pago: R$ 70” / “Juros pendente: R$ 130”
5. Pagar os R$ 130 restantes e confirmar que o fluxo de rolar contrato ocorre como esperado (conforme regra já aprovada).

---

## Arquivo afetado
- `src/pages/Loans.tsx` (somente lógica de detecção e exibição/fallback; não muda banco e não muda cálculos financeiros reais do contrato)

---

## Observação importante
Esse ajuste é especificamente para o que você relatou: **juros parcial não pode ser interpretado como pagamento da parcela**.  
Ele mantém o “principal total” e o “valor da parcela” intactos até que haja pagamento de parcela (via `[PARTIAL_PAID]` ou pagamento normal/total).