

# Plano: Remover Seções Confusas e Substituir por Métricas Úteis

## Problema Identificado

As duas seções que geram confusão:
1. **Próximos Vencimentos** (linhas 396-438) - Lista parcelas a vencer, mas aparece o mesmo cliente várias vezes
2. **Empréstimos Recentes** (linhas 441-487) - Lista empréstimos por data de criação, dados que não fazem sentido para o usuário

Ambas mostram informações redundantes e confusas quando o mesmo cliente tem múltiplos contratos ou parcelas.

## Alterações Técnicas

**Arquivo:** `src/pages/Dashboard.tsx`

- Remover linhas 396-438 (seção "Próximos Vencimentos")
- Remover linhas 441-487 (seção "Empréstimos Recentes")

## Ideias de Substituição

### Opção 1: Saúde da Operação (Score de Saúde)
Um card visual com score de 0-100 mostrando:
- Taxa de recebimento (% do que deveria ter entrado que entrou)
- Taxa de inadimplência (% em atraso)
- Indicadores visuais (verde/amarelo/vermelho)

Baseado no componente `HealthScoreCard.tsx` que já existe no sistema.

### Opção 2: Resumo Consolidado por Categoria
Cards mostrando totais por tipo de negócio:
- Total de cada categoria (Empréstimos, Produtos, Veículos, Contratos)
- % recebido vs pendente de cada
- Mais limpo que listar contratos individuais

### Opção 3: Alertas Inteligentes
Card com alertas importantes:
- Quantos contratos vencem esta semana (sem listar cada um)
- Quantos estão atrasados há mais de 30 dias
- Clientes que precisam de atenção
- Formato resumido, não lista detalhada

### Opção 4: Metas e Desempenho
Card simples mostrando:
- Meta do mês (configurável)
- Quanto já recebeu vs meta
- Barra de progresso visual
- Comparativo com mês anterior

### Opção 5: Top Clientes (Risco/Valor)
Lista resumida mostrando:
- Top 5 clientes com maior valor em aberto
- Top 5 clientes em atraso (agrupados por cliente, não por parcela)
- Evita repetição do mesmo nome

### Minha Recomendação

**Substituir as duas seções por:**

1. **Card de Saúde da Operação** - Visual, informativo, sem dados confusos
2. **Card de Alertas Resumidos** - Apenas números agregados ("5 contratos vencem esta semana", "3 clientes atrasados"), sem listar cada item

Isso mantém o dashboard informativo mas elimina a confusão de ver o mesmo cliente repetido várias vezes com valores diferentes.

## Qual opção você prefere?

Posso implementar qualquer combinação dessas opções. Me diga qual(is) você quer que eu adicione no lugar das seções removidas.

