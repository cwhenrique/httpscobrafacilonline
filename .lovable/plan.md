

## Corrigir comprovante (receipt) para parcelas personalizadas

### Problema

O comprovante de emprestimo exibe "5x de R$ 490,00" (media simples) em vez de mostrar que sao parcelas personalizadas com valores individuais. Isso acontece em 3 locais: o dialog de preview visual, a mensagem WhatsApp e o PDF.

### Causa Raiz

1. **`handleGenerateLoanReceipt` (linha 5593)**: calcula `installmentValue = totalToReceive / numInstallments` sem considerar o modo `custom`
2. **`ContractReceiptData` interface**: so tem um campo `installmentValue: number` - nao suporta array de valores
3. **ReceiptPreviewDialog (linhas 116 e 473)**: exibe `Nx de R$ X` com valor unico
4. **pdfGenerator (linha 410)**: exibe `Nx de R$ X` com valor unico
5. **LoanCreatedReceiptPrompt (linhas 93 e 140)**: mesma exibicao nas mensagens WhatsApp
6. **`setLoanCreatedData` (linha 4240-4252)**: passa `installmentValueNum` como media

### Solucao

**Arquivo: `src/lib/pdfGenerator.ts`**

1. Adicionar campo opcional `customInstallmentValues?: number[]` na interface `ContractReceiptData.negotiation`
2. Na funcao `generateContractReceipt`, quando `customInstallmentValues` existir, exibir "Parcelas Personalizadas" em vez de "5x de R$ 490"

**Arquivo: `src/pages/Loans.tsx`**

3. Em `handleGenerateLoanReceipt` (linha 5593): quando `loan.interest_mode === 'custom'`, usar `parseCustomInstallments(loan.notes)` para preencher `customInstallmentValues` no receipt data
4. Na construcao de `receiptData.dueDates` (linha 5637): usar valor individual de cada parcela para verificar `isPaid` quando custom
5. Em `setLoanCreatedData` (linha 4240-4252): quando o modo for custom, nao calcular media

**Arquivo: `src/components/ReceiptPreviewDialog.tsx`**

6. Na mensagem WhatsApp (linha 116): quando `customInstallmentValues` existir, listar "Parcelas Personalizadas" em vez de "Nx de R$ X"
7. No preview visual (linha 473): mesma logica - mostrar "Parcelas Personalizadas" e listar valores individuais ou apenas indicar que sao personalizadas

**Arquivo: `src/components/LoanCreatedReceiptPrompt.tsx`**

8. Nas funcoes `generateClientMessage` (linha 93) e `generateSelfMessage` (linha 140): quando o emprestimo for custom, nao exibir "Nx de R$ X" e sim indicar parcelas personalizadas

### Exibicao Proposta

Em vez de:
```
Parcelas: 5x de R$ 490,00
```

Exibir:
```
Parcelas Personalizadas
```

Os valores individuais ja aparecem na secao "DATAS DE VENCIMENTO" do comprovante, entao basta remover a informacao enganosa da media.
