

## Melhorar resumo no modo "Calcular por Taxa"

### Problema
No modo "Calcular por Taxa", o resumo da operacao nao mostra claramente quanto o usuario deve pagar pelo cheque. Alem disso, quando "Proporcional aos dias" esta selecionado e as datas sao iguais, o desconto fica zero, o que confunde.

### Alteracoes

**Arquivo: `src/pages/CheckDiscounts.tsx`**

1. **Adicionar linha "Valor a Pagar" no resumo** - No card de "Resumo da Operacao", adicionar uma linha destacada mostrando o valor que o usuario deve pagar pelo cheque (purchase value), alem do lucro. A ordem ficara:
   - Valor do Cheque: R$ 1.000,00
   - Desconto (taxa aplicada): - R$ 100,00
   - **Valor a Pagar pelo Cheque: R$ 900,00** (novo, destacado)
   - Lucro: R$ 100,00
   - Rentabilidade: 10%

2. **Mostrar calculo detalhado da taxa** - Na linha de detalhes, exibir: "Taxa de 10% = desconto de R$ 100,00" para percentual fixo, ou "10% / 30 dias x N dias = desconto de R$ X" para proporcional.

### Detalhes tecnicos

- Alterar o bloco do card de resumo (~linhas 946-991) para incluir a nova linha "Valor a Pagar pelo Cheque" com destaque visual (texto maior, cor primaria)
- Renomear "Valor de Compra" para "Desconto" no modo calculado (ja que o valor de compra sera mostrado separadamente como "Valor a Pagar")
- Manter a logica de calculo existente intacta - apenas melhorar a apresentacao visual
