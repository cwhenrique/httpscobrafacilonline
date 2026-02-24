
# Correcao do Bug: Pagamento Excedente em Vendas de Produtos

## Problema
Quando um cliente paga mais do que o valor da parcela (ex: parcela de R$120, paga R$160), o sistema apenas abate o excedente do saldo total, mas **nao reduz o valor da proxima parcela**. O esperado e que a proxima parcela pendente tenha seu valor reduzido em R$40 (de R$120 para R$80).

## Solucao

### Arquivo: `src/hooks/useProductSales.ts`

Na funcao `markAsPaidFlexible`, apos detectar um overpayment, adicionar logica para:

1. Buscar a proxima parcela pendente (ordenada por `due_date` e `installment_number`)
2. Reduzir o valor dessa parcela pelo excedente
3. Se o excedente for maior ou igual ao valor da proxima parcela, marca-la como paga e continuar aplicando o restante nas parcelas seguintes (cascata)
4. Adicionar nota explicativa na parcela reduzida

### Detalhes Tecnicos

No bloco de overpayment (apos linha 627), adicionar:

```text
OVERPAYMENT (paidAmount > originalAmount):
  1. Buscar todas as parcelas pendentes da venda, ordenadas por due_date ASC
  2. Loop pelo excedente:
     - Se excedente >= valor da parcela: marcar como paga, subtrair, continuar
     - Se excedente < valor da parcela: reduzir o amount da parcela, parar
  3. Adicionar nota "[EXCEDENTE]" nas parcelas afetadas
```

Isso garante que o excedente e distribuido corretamente pelas proximas parcelas, igual ao comportamento esperado pelo usuario.

### Mensagem de Feedback

Atualizar o toast de overpayment para informar qual parcela foi reduzida, ex:
"Excedente de R$ 40,00 abatido da parcela 2 (novo valor: R$ 80,00)"
