
### Diagnóstico (por que ainda aparece R$ 300 e parcela R$ 180)

Pelos prints, o sistema está tratando o pagamento de “juros antigos” (R$ 120) como se fosse abatimento do “restante a receber”, porque em alguns pontos da tela de pagamento ele calcula:

- **Restante a receber (no modal)** = `totalToReceive - total_paid`  
Como `total_paid` inclui esses R$ 120 (juros), acaba virando **420 - 120 = 300**.

Além disso, no seletor de parcelas, ele está mostrando “Pago: R$ 120” e “Falta: R$ 180” porque:
- o modal tenta identificar “pagamento só juros” usando **tags dentro do `loan.notes`** (ex.: `[INTEREST_ONLY_PAYMENT]` e `[INTEREST_ONLY_PAID:...]`)
- mas hoje, no fluxo de “juros antigos”, essas tags ficam **apenas nas notas do pagamento** (`loan_payments.notes`) como `[INTEREST_ONLY_PAYMENT] [HISTORICAL_INTEREST_ONLY_PAID:...]`, e **não** ficam no `loan.notes`
- então o modal não reconhece como “só juros” e usa o `total_paid` como se fosse pagamento parcial da parcela

Resultado: visualmente parece abatimento, mesmo que a intenção seja “juros recebidos sem mexer no total do contrato”.

---

### Objetivo do ajuste (regra correta)
Para contratos de **Juros Antigos** (tag `[HISTORICAL_INTEREST_CONTRACT]`):

1) **Restante a receber deve continuar sendo o total do contrato**  
   - `remaining_balance` deve ficar **sempre = principal + total_interest**  
   - pagamentos de juros antigos entram como **lucro realizado / total_paid**, mas **não** reduzem o “restante a receber”.

2) O modal de pagamento e a lista de parcelas devem:
   - **não usar `total_paid` para reduzir o restante**
   - reconhecer corretamente que houve “pagamento só juros” e **não marcar parcela como parcialmente paga** por isso.

---

### Mudanças que vou fazer (sem alterar banco/estrutura, só lógica de tela e updates do empréstimo)

#### A) Corrigir o update do empréstimo ao registrar juros antigos (criação)
Arquivo: `src/pages/Loans.tsx` (bloco de criação com `selectedHistoricalInterestInstallments`)

1) **Manter `remaining_balance` sempre no total (420)** quando estiver registrando juros antigos:
   - Trocar a regra atual que subtrai `totalHistoricalInterest` quando não é `single`
   - Nova regra: se é contrato com juros antigos (nesse bloco já é), então:
     - `correctedRemainingBalance = principal + correctedTotalInterest` (sempre)

2) **Adicionar tags no `loan.notes` para o front reconhecer “pagamento só juros”**
   - Garantir que `loan.notes` receba:
     - `[INTEREST_ONLY_PAYMENT]` (marcador geral)
     - e, para cada parcela de juros marcada como paga, adicionar também:
       - `[INTEREST_ONLY_PAID:idx:valor:data]`
   - Isso fará o modal/cronograma reconhecer corretamente via `getInterestOnlyPaymentsFromNotes(...)` (que hoje lê `[INTEREST_ONLY_PAID:...]`).

> Importante: isso não muda nenhum valor financeiro, só “ensina” a UI que aqueles pagamentos foram só juros.

---

#### B) Corrigir o modal de pagamento para contratos de Juros Antigos
Arquivo: `src/pages/Loans.tsx` (cálculos dentro do `handlePaymentSubmit` e do modal)

1) Onde hoje existe:
   - `const remainingToReceive = totalToReceive - (selectedLoan.total_paid || 0);`
   
   Vou ajustar para:
   - Se `selectedLoan.notes` contém `[HISTORICAL_INTEREST_CONTRACT]`:
     - `remainingToReceive = selectedLoan.remaining_balance` (que ficará 420 após o ajuste A)
   - Caso contrário, mantém a lógica atual.

2) Ajustar também qualquer trecho do modal que use `selectedLoan.total_paid` para inferir “parcial pago” em contratos de juros antigos, para **não interpretar juros como abatimento**.

---

#### C) Evitar que a parcela apareça como “parcialmente paga” só porque teve juros antigos
Arquivo: `src/pages/Loans.tsx` (função `getInstallmentStatus` dentro do bloco do modal de parcelas, onde existe fallback por `total_paid`)

Hoje, mesmo com várias proteções, ainda pode acontecer de cair em alguma lógica de “fallback” e considerar `total_paid` como pagamento de parcela.

Vou adicionar uma trava explícita:
- Se o contrato tem `[HISTORICAL_INTEREST_CONTRACT]`, o status de “pago/parcial” da parcela deve depender apenas de:
  - tags `[PARTIAL_PAID:...]` (pagamento de parcela)
  - e não de `total_paid` (que aqui é juros)

Com isso:
- “Pago: 120 / Falta: 180” deixa de existir nesse cenário
- A parcela volta a aparecer como **Valor: 420 / Falta: 420** (e, separadamente, mostrar que “juros já pagos: 120”)

---

### Como vamos validar (passo a passo)
1) Criar empréstimo:
   - Principal 300
   - Juros 40% (120)
   - Total a receber 420
   - Marcar 1 pagamento de juros antigo (120) com data 20/01
2) Conferir no card:
   - **Restante a receber: 420**
   - **Parcela: 1x 420**
   - **Pago: 120** (lucro realizado ok)
3) Abrir modal “Pagar”:
   - Topo deve mostrar **Restante: 420**
   - Lista de parcela deve mostrar **Falta: 420** (não 180)
   - E deve indicar (em roxo/verde conforme já existe no layout) que houve juros pagos

---

### Arquivo(s) envolvidos
- `src/pages/Loans.tsx` (principal):
  - bloco de criação com registro de juros antigos (onde atualiza `remaining_balance` e `notes`)
  - cálculos do modal de pagamento (`remainingToReceive`)
  - `getInstallmentStatus` (evitar fallback por `total_paid` para juros antigos)

---

### Observação importante sobre dados já criados
Isso corrige:
- novos empréstimos criados daqui pra frente
- e também a exibição no modal (mesmo para empréstimos antigos), desde que:
  - ou o `loan.notes` já tenha `[HISTORICAL_INTEREST_CONTRACT]`
  - e/ou a nova lógica do modal use `remaining_balance` para esse caso

Se você já tem contratos antigos criados com `remaining_balance = 300` no banco, eles vão continuar 300 até serem recalculados. Se for o caso, eu incluo no final um ajuste opcional (um botão/ação de “recalcular contrato de juros antigos” para voltar `remaining_balance` para 420), mas primeiro vamos corrigir a lógica principal acima.
