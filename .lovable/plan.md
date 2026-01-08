# Plano: Mostrar Prompt de Comprovante ao Criar Empréstimo com Tabela Price

## Problema Identificado

No `PriceTableDialog.tsx`, após criar o empréstimo com sucesso:
1. Mostra um `toast.success`
2. Fecha o diálogo imediatamente (`onOpenChange(false)`)
3. Reseta o formulário

Isso impede que o prompt de comprovante (`LoanCreatedReceiptPrompt`) seja exibido, pois o diálogo é fechado antes que o `Loans.tsx` possa processar o resultado e abrir o prompt.

A lógica no `Loans.tsx` (linhas 12716-12738) já configura os dados e abre o prompt de comprovante corretamente, mas a execução do `onOpenChange(false)` dentro do `PriceTableDialog` interfere.

## Solução

Remover a lógica de fechar o diálogo e mostrar toast de dentro do `PriceTableDialog`, deixando essa responsabilidade para o componente pai (`Loans.tsx`).

## Alterações Necessárias

### Arquivo: `src/components/PriceTableDialog.tsx`

**Linhas 138-154** - Remover o `toast.success`, `onOpenChange(false)` e reset do formulário de dentro do bloco `if (result.data)`:

```typescript
// ANTES (incorreto):
if (result.data) {
  toast.success('Empréstimo Tabela Price criado com sucesso!');
  onOpenChange(false);
  // Reset form
  setFormData({
    client_id: '',
    ...
  });
}

// DEPOIS (correto):
// Não fazer nada aqui - o Loans.tsx já abre o prompt de comprovante
// O reset e fechamento do diálogo serão controlados pelo pai
```

### Arquivo: `src/pages/Loans.tsx`

**Linhas 12716-12742** - Após configurar os dados do comprovante, fechar o diálogo Price e mostrar toast:

```typescript
if (result?.data) {
  const client = clients.find(c => c.id === loanData.client_id);
  const installmentValue = (loanData.principal_amount + loanData.total_interest) / loanData.installments;
  
  setLoanCreatedData({
    // ... dados do empréstimo
  });
  setLoanCreatedInstallmentDates(loanData.installment_dates);
  
  // ADICIONAR: Fechar o diálogo Price e mostrar toast
  setIsPriceTableDialogOpen(false);
  toast.success('Empréstimo Tabela Price criado com sucesso!');
  
  // ADICIONAR: Pequeno delay para garantir que o diálogo Price feche antes de abrir o prompt
  setTimeout(() => {
    setIsLoanCreatedOpen(true);
  }, 100);
}
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/PriceTableDialog.tsx` | Remover `toast.success`, `onOpenChange(false)` e reset do form do bloco `if (result.data)` |
| `src/pages/Loans.tsx` | Adicionar `setIsPriceTableDialogOpen(false)`, `toast.success` e `setTimeout` para abrir o prompt de comprovante |

## Resultado Esperado

Após criar um empréstimo com Tabela Price:
1. O diálogo Price fecha
2. O toast de sucesso aparece
3. O prompt de comprovante (`LoanCreatedReceiptPrompt`) é exibido com opções para:
   - Copiar texto
   - Enviar para si mesmo via WhatsApp
   - Enviar para o cliente via WhatsApp
   - Baixar PDF
