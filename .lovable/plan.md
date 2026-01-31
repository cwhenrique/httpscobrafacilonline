
# Plano: Incluir Multas e Juros de Atraso Pagos no Score do Cliente

## Problema Identificado

Atualmente, o sistema de score do cliente considera apenas:
- Empréstimos pagos em dia (+3 pontos)
- Empréstimos em atraso (-20 pontos)
- Atrasos críticos (+30 dias) (-10 pontos adicionais)
- Bônus de fidelidade (+15 pontos)

**O que falta:** Quando um cliente em atraso paga as multas/juros de atraso aplicados, esse comportamento "recuperador" não melhora o score.

## Proposta de Solução

Adicionar uma nova métrica ao score que considera **pagamentos extras** (multas e juros de atraso pagos):

### Nova Fórmula de Score

```text
Score = 100
  + (pagamentos em dia × 3)
  - (atrasos × 20)
  - (atrasos críticos × 10)
  + (bônus fidelidade × 15)
  + (bônus recuperação × N)  ← NOVO
```

**Bônus de recuperação:** Quando o cliente paga valores acima do previsto (multas, juros de atraso), isso demonstra que está se recuperando. Esse bônus mitiga parte da penalidade de atraso.

### Lógica do Bônus de Recuperação

1. Calcular o "Lucro Extra" recebido deste cliente (já existe no sistema)
2. Para cada R$50 pagos em multas/juros extras: +2 pontos de recuperação
3. Limite máximo de +10 pontos de recuperação por cliente

## Alterações Técnicas

### Arquivo 1: `src/lib/updateClientScore.ts`

- Buscar pagamentos do cliente com `interest_paid`
- Calcular o total de juros previstos vs recebidos
- Adicionar bônus de recuperação quando `interest_paid > expected_interest`

### Arquivo 2: `src/hooks/useClientScore.ts`

- Atualizar a mesma lógica para exibição em tempo real na UI

### Arquivo 3: `src/pages/ClientScores.tsx`

- Mostrar o bônus de recuperação na explicação do score
- Exibir badge "Recuperado" para clientes com bônus de recuperação

## Visualização na UI

No card de cada cliente na página de Score, exibir:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Score | 63 | 73 |
| Badge | 🚨 Crítico | 👌 Regular |
| Nova info | — | +10 pts recuperação |

## Fluxo de Dados

```text
Pagamento com multa registrado
    ↓
loan_payments.interest_paid > juros previstos
    ↓
updateClientScore() detecta "extra profit"
    ↓
Aplica bônus de recuperação ao score
    ↓
Atualiza tabela clients.score
```

## Resumo das Alterações

1. **`src/lib/updateClientScore.ts`** - Adicionar cálculo de bônus de recuperação baseado em pagamentos extras
2. **`src/hooks/useClientScore.ts`** - Sincronizar lógica para cálculos em tempo real
3. **`src/pages/ClientScores.tsx`** - Exibir bônus de recuperação na UI e explicação do score

Nenhuma alteração de banco de dados é necessária, pois os dados já existem na tabela `loan_payments.interest_paid`.
