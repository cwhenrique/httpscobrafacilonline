
# Correção: Mensagem de Cobrança Não Atualiza Após Amortização

## Problema Identificado

Quando o usuário faz uma amortização, o **valor total da parcela** na mensagem de cobrança é atualizado corretamente (via `getEffectiveInstallmentValue` que usa `remaining_balance / parcelas_restantes`). Porém, os campos **interestAmount** (juros por parcela) e **principalAmount** (principal por parcela) continuam usando os valores **originais** do empréstimo, sem considerar a amortização.

Isso afeta:
- A seção "Opções de Pagamento" na mensagem (ex: "Só juros: R$ X" e "Parcela de R$ Y segue para próximo mês")
- O cálculo de juros por atraso baseado em percentual (que usa `totalPerInstallment` original)
- O cálculo de multa dinâmica por percentual

## Causa Raiz

No arquivo `src/pages/Loans.tsx`, ao montar os dados para os componentes de notificação (`SendOverdueNotification`, `SendDueTodayNotification`, `SendEarlyNotification`):

```
// Linha 8106 - Sempre usa principal ORIGINAL
const principalPerInstallment = loan.principal_amount / numInstallments;

// Linha 8126 - Sempre usa juros ORIGINAIS  
const calculatedInterestPerInstallment = effectiveTotalInterest / numInstallments;

// Linha 9186 - CORRETO: usa remaining_balance após amortização
amount: getEffectiveInstallmentValue(loan, totalPerInstallment, getPaidInstallmentsCount(loan)),

// Linhas 9194-9195 - INCORRETO: usa valores originais
interestAmount: calculatedInterestPerInstallment,  // juros originais
principalAmount: principalPerInstallment,           // principal original
```

## Plano de Correção

### Modificar `src/pages/Loans.tsx`

Em todos os locais onde os dados de notificação são montados (cards de empréstimo e tabela), recalcular `principalAmount` e `interestAmount` considerando amortizações:

1. Após calcular `getEffectiveInstallmentValue`, verificar se houve amortização
2. Se houve, extrair o novo principal e novos juros da tag `[AMORTIZATION:valor:novo_principal:novos_juros:data]` mais recente
3. Calcular `principalPerInstallmentEffective` e `interestPerInstallmentEffective` com base nos novos valores

**Lógica:**
```
const totalAmortizations = getTotalAmortizationsFromNotes(loan.notes);
if (totalAmortizations > 0 && !isDaily) {
  // Extrair ultimo AMORTIZATION tag para pegar novo principal e novos juros
  const amortTags = loan.notes.matchAll(/\[AMORTIZATION:[0-9.]+:([0-9.]+):([0-9.]+):/g);
  let lastNewPrincipal = loan.principal_amount;
  let lastNewInterest = effectiveTotalInterest;
  for (const m of amortTags) {
    lastNewPrincipal = parseFloat(m[1]);
    lastNewInterest = parseFloat(m[2]);
  }
  const paidCount = getPaidInstallmentsCount(loan);
  const remaining = Math.max(1, numInstallments - paidCount);
  principalPerInstallmentEffective = lastNewPrincipal / numInstallments;
  interestPerInstallmentEffective = lastNewInterest / numInstallments;
}
```

4. Passar esses valores efetivos para os componentes de notificação em vez dos originais

### Locais a Alterar

Existem multiplas instancias no arquivo onde `interestAmount` e `principalAmount` sao passados aos componentes de notificacao. Todos precisam ser atualizados:

- Cards de emprestimos (seção de cards - ~linhas 9186-9195)
- Cards de emprestimos duplicados (seção inferior - ~linhas 11339+)
- Tabela de emprestimos (`getOverdueNotificationData` - ~linhas 7948+)
- Notificações "Vence Hoje" e "Antecipar" nos mesmos escopos

### Arquivos a Modificar

- `src/pages/Loans.tsx` (unico arquivo)
