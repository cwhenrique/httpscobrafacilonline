

## Corrigir botao "Pagar" que desaparece em Vendas de Produtos

### Problema Identificado

O usuario Fernando Gomes tem **1.943 parcelas** na tabela `product_sale_payments`, porem o Supabase retorna no maximo **1.000 registros** por consulta (limite padrao). Como a query busca TODAS as parcelas de uma vez sem paginacao, muitas vendas ficam sem suas parcelas carregadas, fazendo o botao "Pagar" desaparecer.

### Solucao

Remover o limite de 1000 registros adicionando `.limit()` maior ou usando paginacao. A abordagem mais simples e segura e buscar todas as parcelas em lotes.

### Alteracoes

**Arquivo: `src/hooks/useProductSales.ts`**

Na funcao `useProductSalePayments` (linha ~447-468), alterar a query para buscar todos os registros em lotes de 1000, concatenando os resultados:

```typescript
queryFn: async () => {
  if (!effectiveUserId) throw new Error('Usuario nao autenticado');

  const allData: ProductSalePayment[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('product_sale_payments')
      .select('*, productSale:product_sales(*)')
      .eq('user_id', effectiveUserId)
      .order('due_date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (saleId) {
      query = query.eq('product_sale_id', saleId);
    }

    const { data, error } = await query;
    if (error) throw error;

    allData.push(...(data as ProductSalePayment[]));
    hasMore = data.length === pageSize;
    from += pageSize;
  }

  return allData;
}
```

Isso garante que todas as parcelas sejam carregadas independente da quantidade, buscando em paginas de 1000 ate nao haver mais dados.

