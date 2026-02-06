

## Plano: Corrigir Lógica de Atraso para Contratos de Juros Antigos

### Problema Identificado

O sistema está impedindo que contratos de juros antigos apareçam no filtro de "atrasados" quando deveriam. O problema ocorre porque:

1. A função `getInterestPaidInstallmentsCount()` conta corretamente as parcelas com juros pagos
2. Esse valor é usado para calcular `paidInstallments`
3. Mas a lógica de verificação de atraso (linhas 2537-2550) tem um bug:
   - Quando `futureDates.length > 0`, ele busca apenas datas `>= hoje`
   - Se `paidInstallments = 1` (juros pago da parcela 1), e a parcela 2 tem data no passado, ele **não detecta o atraso**

**Exemplo do bug:**
- Contrato com 1 parcela, juros pago em 20/01/2026 (parcela 1 coberta)
- `paidInstallments = 1`
- `dates.slice(1)` = vazio (só tinha 1 parcela)
- Sistema não encontra data em atraso porque não há mais parcelas após a coberta

**Cenário que deveria funcionar:**
- Se o usuário alterar a data do contrato para uma data passada (ex: 10/01/2026)
- E não houver pagamento de juros para essa data
- O contrato deveria aparecer em atraso

### Causa Raiz

A lógica atual está usando `futureDates` (datas >= hoje) para verificar se há atraso, mas deveria verificar se há **datas não cobertas** (após `paidInstallments`) que estão no passado.

### Solução

Simplificar a lógica para contratos de juros antigos:

1. Encontrar a próxima parcela **não coberta** (após `paidInstallments`)
2. Se essa parcela tem data no passado → em atraso
3. Se essa parcela tem data no futuro ou hoje → não está em atraso

### Alteração no arquivo `src/pages/Loans.tsx`

**Linhas ~2537-2580**: Substituir a lógica complexa por uma mais simples e correta:

```typescript
// ANTES (complexo e com bugs):
if (isHistoricalInterestContract && futureDates.length > 0) {
  const nextValidDate = dates.slice(paidInstallments).find(d => d >= todayStr);
  if (nextValidDate) {
    // ...lógica
  }
  // Se não há data não paga >= hoje, não está em atraso (ERRADO!)
} else if (futureDates.length === 0 && paidInstallments < dates.length) {
  // ...
}

// DEPOIS (simples e correto):
if (isHistoricalInterestContract) {
  // Para contratos de juros antigos, verificar a primeira parcela NÃO COBERTA
  // paidInstallments = quantidade de parcelas com juros já pagos
  if (paidInstallments < dates.length) {
    // Há parcelas não cobertas por pagamentos de juros
    const nextUnpaidDate = dates[paidInstallments];
    const nextUnpaidDateObj = new Date(nextUnpaidDate + 'T12:00:00');
    nextUnpaidDateObj.setHours(0, 0, 0, 0);
    
    // Em atraso se hoje > data da próxima parcela não coberta
    isOverdue = today > nextUnpaidDateObj;
    if (isOverdue) {
      overdueDate = nextUnpaidDate;
      overdueInstallmentIndex = paidInstallments;
      daysOverdue = Math.ceil((today.getTime() - nextUnpaidDateObj.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  // Se paidInstallments >= dates.length, todas as parcelas estão cobertas
  // Contrato não está em atraso (usuário terá que renovar ou quitar)
}
```

### Comportamento Esperado Após Correção

**Cenário 1: Juros pago, data rolou para o futuro**
- Principal: R$ 300, Juros: R$ 120, Total: R$ 420
- Data original: 20/01/2026, pagou juros → data rolou para 20/02/2026
- `paidInstallments = 1`, `dates = ["2026-02-20"]`
- Próxima não coberta: `dates[1]` = undefined (parcela única, só 1 data)
- **Resultado**: NÃO está em atraso ✅

**Cenário 2: Data alterada para o passado, sem pagamento**
- Data alterada para 10/01/2026
- Nenhum pagamento de juros registrado
- `paidInstallments = 0`, `dates = ["2026-01-10"]`
- Próxima não coberta: `dates[0]` = "2026-01-10" < hoje (06/02)
- **Resultado**: EM ATRASO ✅ (aparece no filtro de atrasados)

**Cenário 3: Múltiplas parcelas, algumas com juros pago**
- 3 parcelas: 20/01, 20/02, 20/03
- Juros pago em 20/01 e 20/02
- `paidInstallments = 2`, `dates = ["2026-01-20", "2026-02-20", "2026-03-20"]`
- Próxima não coberta: `dates[2]` = "2026-03-20" > hoje
- **Resultado**: NÃO está em atraso ✅

**Cenário 4: Múltiplas parcelas, parcela vencida sem juros**
- 3 parcelas: 20/01, 20/02, 20/03
- Apenas juros pago em 20/01
- `paidInstallments = 1`, hoje = 25/02
- Próxima não coberta: `dates[1]` = "2026-02-20" < hoje (25/02)
- **Resultado**: EM ATRASO ✅

### Arquivos a Modificar

- **`src/pages/Loans.tsx`**: Simplificar a lógica de atraso para contratos de juros antigos (linhas ~2536-2580)

### Resultado Final

Contratos de juros antigos:
- Aparecem no filtro de atrasados quando há parcelas não cobertas por pagamento de juros e a data dessa parcela está no passado
- NÃO aparecem em atraso quando todas as parcelas estão cobertas ou a próxima data é futura/hoje

