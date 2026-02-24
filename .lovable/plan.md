

# Correcao: Progresso de Parcelas no Comprovante de Emprestimos Diarios

## Problema Identificado

O comprovante de pagamento de emprestimos diarios nao exibe a lista de progresso das parcelas porque o sistema tem um limite de **60 parcelas** na funcao `generateInstallmentStatusList` (arquivo `src/lib/messageUtils.ts`, linha 132):

```text
if (installmentDates.length > 60) {
    return '';  // <-- retorna vazio, sem lista de parcelas
}
```

Emprestimos diarios frequentemente ultrapassam 60 parcelas (ex: 90 dias, 120 dias), fazendo com que o comprovante seja enviado sem o bloco de status das parcelas.

## Solucao

### Arquivo: `src/lib/messageUtils.ts`

**Mudanca 1**: Aumentar o limite ou implementar uma lista resumida inteligente para emprestimos com mais de 60 parcelas:

- Para contratos com ate 60 parcelas: comportamento atual (mostra todas)
- Para contratos com 61-180 parcelas: mostrar apenas as parcelas pagas + as proximas 5 em aberto + resumo (ex: "... e mais 45 parcelas em aberto")
- Para contratos com mais de 180 parcelas: mostrar apenas um resumo numerico (ex: "15 pagas / 30 em atraso / 45 em aberto")

Isso garante que emprestimos diarios de longa duracao (90, 120, 150 dias) tambem tenham o progresso visivel no comprovante.

### Detalhes Tecnicos

Na funcao `generateInstallmentStatusList`:

1. Remover o `return ''` para `> 60`
2. Adicionar logica de resumo inteligente:
   - Contar pagas, em atraso e em aberto
   - Mostrar as ultimas 3 pagas + proximas 5 pendentes
   - Adicionar linha de resumo com totais

### Arquivo: `src/pages/Loans.tsx`

**Mudanca 2**: Garantir que `paidIndices` inclua as parcelas recem-pagas no momento do comprovante, mesmo antes da atualizacao das notes no banco.

A logica atual (linhas 5354-5358) ja faz o merge, mas ha um caso nao coberto: quando `paymentData.selected_installments` esta vazio e `targetInstallmentIndex` e `-1` (pagamento total ou diario simples), nenhum novo indice e adicionado. Corrigir para incluir o indice correto baseado no `paidCount`.

