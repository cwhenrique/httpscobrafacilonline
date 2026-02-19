

# Correção: Multa/Juros por Atraso Não Incluídos no Pagamento e Comprovante

## Problema Identificado

O sistema exibe corretamente o valor da parcela com multa/juros de atraso na interface (dialog de pagamento), mas ao registrar o pagamento, o valor registrado é apenas o da parcela base, sem incluir a multa. O comprovante também mostra o valor sem multa.

**Causa raiz:** Existem duas funções `getInstallmentValue` diferentes no código:

1. **Na interface (linha ~12492):** Calcula `base + multa (DAILY_PENALTY) + juros dinâmicos (OVERDUE_CONFIG)` - valor CORRETO mostrado ao usuário
2. **No processamento do pagamento (linha ~4354):** Calcula apenas `base + multa (DAILY_PENALTY)` - **FALTA o juros dinâmico de atraso**

Além disso, a lógica de "consolidação" (que adiciona juros de atraso ao `remaining_balance` antes do pagamento) é apagada pelo trigger `recalculate_loan_total_paid`, que recalcula `remaining_balance` usando apenas os valores originais do contrato.

## Solução

### 1. Incluir juros dinâmicos de atraso no `getInstallmentValue` do processamento de pagamento

No bloco de processamento (linha ~4354), a função `getInstallmentValue` será atualizada para incluir os juros dinâmicos de atraso (calculados via `OVERDUE_CONFIG`), da mesma forma que a versão da interface faz.

Isso fará com que o `amount` registrado no `registerPayment` já inclua a multa/juros de atraso.

### 2. Consolidar multas como DAILY_PENALTY antes do pagamento

Em vez de apenas somar ao `remaining_balance` (que é sobrescrito pelo trigger), o sistema vai:
- Calcular os juros dinâmicos de atraso para cada parcela sendo paga
- Salvar como tag `[DAILY_PENALTY:index:valor]` nas notas do empréstimo ANTES do pagamento
- Isso garante que o `getInstallmentValue` (processamento) captura automaticamente o valor via `loanPenalties[index]`

### 3. Corrigir o comprovante

A seção que calcula `totalPenaltyPaid` (linhas ~5149-5163) já lê de `loanPenalties`, então com a correção do item 2 (salvar como DAILY_PENALTY), o comprovante passará a mostrar o valor correto automaticamente.

### 4. Remover a consolidação redundante

A lógica de consolidação atual (linhas 4163-4244) que soma ao `remaining_balance` pode ser removida ou simplificada, já que o mecanismo correto é incluir os juros como DAILY_PENALTY e deixar o `getInstallmentValue` cuidar do resto.

## Detalhes Técnicos

### Arquivo: `src/pages/Loans.tsx`

**Mudança principal - Bloco de consolidação (~linha 4163-4244):**

Em vez de adicionar ao `remaining_balance` (que é sobrescrito pelo trigger), o código vai:

```typescript
// Para cada parcela selecionada, calcular juros dinâmicos e salvar como DAILY_PENALTY
if (daysOverdueForConsolidation > 0 && overdueConfigType && overdueConfigValue > 0) {
  const existingPenalty = penaltiesForConsolidation[paidCountForConsolidation] || 0;
  
  // Se ainda não há DAILY_PENALTY para esta parcela, criar automaticamente
  if (existingPenalty === 0) {
    const penaltyTag = `[DAILY_PENALTY:${paidCountForConsolidation}:${dynamicOverdueInterest.toFixed(2)}]`;
    let updatedNotesForPenalty = loanNotes;
    updatedNotesForPenalty = `${penaltyTag}\n${updatedNotesForPenalty}`.trim();
    
    await supabase.from('loans').update({
      notes: updatedNotesForPenalty
    }).eq('id', selectedLoanId);
    
    // Atualizar referências locais
    selectedLoan.notes = updatedNotesForPenalty;
  }
}
```

Isso garante que:
- O juros dinâmico é materializado como DAILY_PENALTY
- O `getInstallmentValue` do processamento inclui o valor
- O `PARTIAL_PAID` salva o valor correto (com multa)
- O comprovante mostra a multa separada
- O trigger `recalculate_loan_total_paid` calcula corretamente (pois o `amount` do pagamento já inclui a multa)

**Para pagamentos de múltiplas parcelas (installment type):** A mesma lógica será aplicada a cada parcela selecionada, garantindo que cada uma tenha seu DAILY_PENALTY materializado antes do processamento.

## Impacto

- Pagamentos futuros incluirão corretamente o valor da multa/juros de atraso
- Comprovantes mostrarão o valor da multa separadamente
- Dados já pagos (como as parcelas da Vitória Rodrigues dos Santos) NÃO serão alterados retroativamente
- Nenhuma mudança no banco de dados (apenas lógica no frontend)

