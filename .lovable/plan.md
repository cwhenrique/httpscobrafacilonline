
## Correção: Parcelas SAC com Valores Individuais Decrescentes

### Problema
Atualmente, ao criar um empréstimo SAC, todas as parcelas aparecem com o mesmo valor (total dividido igualmente). No SAC, cada parcela deve ter um valor diferente e decrescente, pois a amortização é constante mas os juros diminuem conforme o saldo devedor cai.

### Exemplo Esperado (R$ 10.000, 10% a.m., 5 parcelas)
- Parcela 1: R$ 3.000 (R$ 2.000 amort. + R$ 1.000 juros)
- Parcela 2: R$ 2.800 (R$ 2.000 amort. + R$ 800 juros)
- Parcela 3: R$ 2.600 (R$ 2.000 amort. + R$ 600 juros)
- Parcela 4: R$ 2.400 (R$ 2.000 amort. + R$ 400 juros)
- Parcela 5: R$ 2.200 (R$ 2.000 amort. + R$ 200 juros)

### Correções no `src/pages/Loans.tsx`

Todas as funções `getInstallmentBaseValue` e `getInstallmentValue` que retornam `totalPerInstallment` (valor fixo) precisam verificar se `interest_mode === 'sac'` e, nesse caso, usar `calculateSACInstallmentValue(principal, rate, installments, index)` para retornar o valor correto de cada parcela.

**Locais a corrigir:**

1. **Linha ~12484 - `getInstallmentBaseValue` no dialog de pagamento por parcela**: Em vez de retornar `totalPerInstallment`, verificar se é SAC e calcular o valor individual.

2. **Linha ~12370 - calculo de `totalPerInstallment`**: Para SAC, o `totalPerInstallment` exibido no header do dialog deve mostrar a primeira parcela como referência, mas cada parcela individual usa seu próprio valor.

3. **Linha ~4398 - `getInstallmentValue` no processamento de pagamento**: Adicionar tratamento SAC para calcular valor correto da parcela sendo paga.

4. **Linhas ~8115, ~8187, ~8275, ~10509, ~10581 - displays de lista de empréstimos**: Onde `totalPerInstallment` é usado para exibir valor na listagem, para SAC mostrar o valor da primeira parcela ou indicar "decrescente".

5. **Linha ~13469 - calculo no dialog de detalhes**: Usar valor SAC individual.

6. **Linhas ~435-439 - `getInstallmentValue` em `getPaidInstallmentsCount`**: Já tratado no `calculations.ts`, mas verificar consistência.

### Detalhes Tecnicos

Em cada local onde há `getInstallmentBaseValue` ou cálculo de `totalPerInstallment`, adicionar:

```typescript
// Dentro de getInstallmentBaseValue:
if (selectedLoan.interest_mode === 'sac') {
  return calculateSACInstallmentValue(
    selectedLoan.principal_amount,
    selectedLoan.interest_rate,
    numInstallments,
    index
  );
}
return totalPerInstallment;
```

Para o header do dialog de pagamento (que mostra "Parcela: R$ X.XXX"):
```typescript
// Para SAC, mostrar primeira e última parcela
if (selectedLoan.interest_mode === 'sac') {
  const firstInstallment = calculateSACInstallmentValue(principal, rate, n, 0);
  const lastInstallment = calculateSACInstallmentValue(principal, rate, n, n - 1);
  // Exibir: "Parcela: R$ 3.000 → R$ 2.200 (SAC)"
}
```

Para o processamento de pagamento (`handlePaymentSubmit`), a mesma lógica se aplica: o valor esperado de cada parcela deve ser calculado individualmente usando `calculateSACInstallmentValue`.

Isso garante que:
- Cada parcela aparece com seu valor correto (decrescente)
- Os pagamentos são validados contra o valor correto de cada parcela
- O display mostra claramente que é um empréstimo com parcelas variáveis
