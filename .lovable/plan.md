

# Melhorar visibilidade e clareza do "Caixa Extra"

## O que muda

O botao "Adicionar caixa extra" atual e muito discreto (texto pequeno, cor apagada) e nao explica o que significa. Vamos tornar mais visivel e explicativo para que o usuario entenda que precisa informar manualmente o dinheiro que tem disponivel no banco/em maos.

## Mudancas no arquivo `src/components/reports/CashFlowCard.tsx`

### Quando o Caixa Extra esta vazio (linhas 154-162)

Substituir o botao discreto por um bloco visual com fundo, icone e texto explicativo:

```text
+--------------------------------------------------+
| [icone cofrinho]                                  |
| Caixa Extra                         [+ Adicionar] |
| Informe aqui o dinheiro que voce tem              |
| disponivel no banco ou em maos e que              |
| ainda nao foi emprestado.                         |
| Este valor nao e calculado automaticamente.       |
+--------------------------------------------------+
```

- Fundo azul claro com borda tracejada (estilo "call to action")
- Texto explicativo curto dizendo que e um valor manual, nao puxado dos emprestimos
- Botao "Adicionar" visivel

### Quando o Caixa Extra tem valor (linhas 132-153)

Adicionar uma linha extra de texto explicativo abaixo do valor:

- Trocar "Dinheiro disponivel nao emprestado" por "Valor informado manualmente - nao e calculado dos emprestimos"

### Modal de configuracao (`CashFlowConfigModal.tsx`)

Adicionar um alerta/nota no topo do modal explicando:
- "Informe aqui quanto dinheiro voce tem disponivel que ainda nao foi emprestado. Esse valor e inserido por voce e nao e calculado automaticamente pelo sistema."

## Detalhes tecnicos

### 1. `CashFlowCard.tsx` - Bloco vazio (linhas 154-162)

Substituir o `<button>` discreto por um `<div>` estilizado com:
- `border border-dashed border-blue-500/30 bg-blue-500/5 rounded-xl p-3`
- Icone `PiggyBank` + titulo "Caixa Extra"
- Texto explicativo em `text-xs text-muted-foreground`
- Botao `Button` com variante outline azul

### 2. `CashFlowCard.tsx` - Bloco com valor (linhas 137-139)

Trocar o subtexto de "Dinheiro disponivel nao emprestado" para "Valor informado manualmente"

### 3. `CashFlowConfigModal.tsx` - Nota explicativa

Adicionar um bloco `bg-blue-500/10 rounded-lg p-3` no inicio do `space-y-4` (antes do input) com texto explicando que o valor e manual e nao vem dos emprestimos.

