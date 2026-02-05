
## Diagnóstico (por que ainda fica “Quitado”)
Pelos registros de rede, a rotina até executa o fluxo de “pagar” (PATCH status=paid), mas na hora de calcular o **próximo mês** ela está calculando errado:

- O código faz: `const currentRefMonth = new Date(payment.reference_month)`
- `payment.reference_month` vem como string tipo `"2026-02-01"` (data sem horário).
- Em navegadores, `new Date("YYYY-MM-DD")` costuma ser interpretado como **UTC**. No fuso do Brasil (ex.: -03), isso vira **dia anterior 21:00** (ex.: 31/01 21:00).
- Aí `addMonths(currentRefMonth, 1)` em cima de “31/01 21:00” pode cair em **final de fevereiro**, e quando você faz `format(nextMonth, 'yyyy-MM-01')`, o resultado acaba ficando **2026-02-01** (o mesmo mês), em vez de **2026-03-01**.

Isso aparece claramente no request:
- o sistema checou `reference_month=eq.2026-02-01` (deveria ser 2026-03-01)
- portanto ele não chega a inserir o mês seguinte corretamente e a assinatura fica sem cobrança pendente -> UI mostra “Pago/Quitado”.

## Objetivo
Garantir que ao pagar 10/02:
- o sistema sempre crie a cobrança **10/03** (status `pending`)
- e o botão “Pagar” apareça imediatamente para o próximo mês.

---

## O que vou mudar (código) — sem alterar estrutura do banco
### 1) Corrigir parsing de `reference_month` (evitar UTC)
Arquivo: `src/hooks/useMonthlyFees.ts`

Mudança principal no `markAsPaid`:
- Substituir `new Date(payment.reference_month)` por uma criação de data **local** (sem UTC), por exemplo:
  - `const [y,m] = payment.reference_month.split('-')` e `new Date(Number(y), Number(m)-1, 1)`
  - (ou `parseISO` + normalização para “início do mês” em local, mas o método por `new Date(y, m-1, 1)` é o mais “à prova de fuso”.)

E então:
- `const nextMonthStart = addMonths(refMonthStart, 1)`
- `const nextReferenceMonth = format(nextMonthStart, 'yyyy-MM-01')` (agora vai gerar 2026-03-01 corretamente)

### 2) Corrigir o mesmo bug em `generatePayment`
No mesmo arquivo, a mutation `generatePayment` usa:
- `const refDate = new Date(referenceMonth)`
Isso pode gerar vencimento errado dependendo do fuso.
Vou aplicar o mesmo parsing seguro “date-only local”.

### 3) (Opcional, mas recomendado) Criar um helper interno
Ainda em `useMonthlyFees.ts`, criar uma função pequena para padronizar e evitar regressão:

- `parseMonthStartLocal(referenceMonth: string): Date`
- `parseDateOnlyLocal(yyyyMmDd: string): Date` (se necessário)

E usar em todos os lugares que hoje fazem `new Date('YYYY-MM-DD')`.

---

## Correção de dados (para destravar o caso atual)
No seu caso real (cliente “devedor 02”):
- `monthly_fee_id = 149e8e52-939f-4370-8f08-48c917d1612b`
- existe apenas a cobrança `2026-02-01` marcada como `paid`
- não existe `2026-03-01`

Na implementação, vou inserir manualmente a cobrança pendente de março (com proteção “NOT EXISTS” para não duplicar), com:
- `reference_month = 2026-03-01`
- `due_date = 2026-03-10`
- `amount = 50`
- `status = pending`
- `user_id` igual ao da assinatura

---

## Como validar (passo a passo)
1) Em `/product-sales` → aba Assinaturas → “devedor 02”.
2) (Após inserir o mês 03 manualmente) confirmar que aparece cobrança pendente e botão “Pagar”.
3) Criar uma nova assinatura com `due_day=10` e gerar o mês atual.
4) Marcar como paga.
5) Verificar no tráfego de rede que agora:
   - o check de existente usa `reference_month=2026-03-01` (não 2026-02-01)
   - ocorre um `POST monthly_fee_payments` criando o próximo mês
6) Confirmar que a UI mostra imediatamente o próximo mês pendente e o botão “Pagar”.

---

## Riscos / cuidados
- Essa correção mexe apenas em parsing de datas e na geração do próximo mês, não altera schema.
- A falha era dependente do fuso; após a correção, deve funcionar igual em qualquer dispositivo.

Se aprovado, na próxima etapa (modo implementação) eu:
1) ajusto `useMonthlyFees.ts` (markAsPaid + generatePayment) para parsing local
2) insiro a cobrança 03/2026 pendente para essa assinatura afetada
3) valido via rede se o nextReferenceMonth está indo como 2026-03-01 e se o POST do próximo mês acontece.
