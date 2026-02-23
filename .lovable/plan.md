

## Adicionar botao de baixar PDF no historico de pagamentos

### O que sera feito

Adicionar um botao de download PDF ao lado dos botoes existentes (reenviar, editar, excluir) em cada registro do historico de pagamentos. O botao usara a funcao `generatePaymentReceipt` que ja existe no projeto.

### Alteracao

**Arquivo: `src/pages/Loans.tsx`**

1. Criar funcao `handleDownloadPaymentPDF(payment)` que monta os dados do `PaymentReceiptData` a partir do pagamento e do emprestimo atual (`paymentHistoryLoanId`), e chama `generatePaymentReceipt`.

2. Na area de botoes do historico (entre o botao "Reenviar comprovante" e "Editar data", ~linha 14714-14727), adicionar um novo botao com icone `Download`:

```
[Reenviar] [Download PDF] [Editar] [Excluir]
```

### Detalhes tecnicos

- Importar `generatePaymentReceipt` e `PaymentReceiptData` de `@/lib/pdfGenerator` (ja existe import de `generateContractReceipt`)
- A funcao `handleDownloadPaymentPDF` buscara o loan pelo `paymentHistoryLoanId`, montara o objeto `PaymentReceiptData` com: tipo `'loan'`, contractId, companyName, clientName, installmentNumber, totalInstallments, amountPaid, paymentDate, remainingBalance, penaltyAmount, etc.
- Icone: `Download` do lucide-react
- Tooltip: "Baixar comprovante PDF"
- Estilo consistente com os demais botoes (ghost, icon, h-8 w-8)
