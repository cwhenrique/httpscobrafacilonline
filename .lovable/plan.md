
# Redesign Visual: Fluxo de Caixa com Hierarquia de Cores Clara

## Problemas identificados na UI atual

1. **Inconsistência de cores nas Saídas**: "Empréstimos concedidos" usa vermelho (`destructive`), "Contas a pagar" usa laranja, e "Custos extras" usa roxo. Três paletas diferentes para o mesmo conceito (saída de dinheiro) cria confusão.

2. **"Contas a pagar" e "Custos extras" têm apresentações visuais totalmente diferentes**: Contas a pagar tem um card com fundo colorido e toggle; Custos extras tem um card com borda, header separado e lista aninhada. Parecem componentes de sistemas distintos.

3. **Falta de coesão visual**: O usuário não identifica rapidamente qual item é uma saída e qual é uma entrada, pois as cores não são consistentes.

---

## Sistema de cores proposto

| Categoria | Cor | Uso |
|---|---|---|
| Saídas (todas) | Vermelho (`red-500` / `destructive`) | Empréstimos + Contas a pagar + Custos extras |
| Entradas (todas) | Verde (`emerald-500`) | Pagamentos + Juros |
| Saldo Atual | Verde se positivo / Vermelho se negativo | Dinâmico |
| Capital Inicial | Azul (`blue-500`) | Referência neutra |

---

## Redesign da seção SAÍDAS

### Estrutura unificada — todos os itens de saída seguem o mesmo padrão visual:

```
┌─────────────────────────────────────────────────────────┐
│  ↑ SAÍDAS                                               │  ← header vermelho
├─────────────────────────────────────────────────────────┤
│  • Empréstimos concedidos              -R$ 31.000       │  ← linha padrão vermelha
├─────────────────────────────────────────────────────────┤
│  🧾 Contas a pagar      [toggle]       -R$ 500          │  ← mesma linha vermelha + toggle
│     3 contas pagas no período                           │
├─────────────────────────────────────────────────────────┤
│  Custos extras (avulsos)               -R$ 200          │  ← mesmo padrão vermelho
│    • Gasolina  15/02           -R$ 120  [🗑]            │
│    • Almoço    18/02           -R$ 80   [🗑]            │
│    [+ Adicionar custo extra]                            │
├─────────────────────────────────────────────────────────┤
│  Total saídas                          -R$ 31.700       │  ← vermelho bold
└─────────────────────────────────────────────────────────┘
```

**Princípio**: Todos os sub-itens de saída são linhas simples no mesmo container vermelho, sem cards dentro de cards, sem diferentes fundos coloridos por tipo.

### Contas a pagar — novo layout

Em vez de um card separado com fundo laranja, vira uma **linha simples** dentro da seção Saídas, igual às demais, com o toggle discretamente à direita:

```
• Contas a pagar (3 pagas)    [◉ toggle]    -R$ 500
```

Quando desativado, o valor fica acinzentado e riscado (`line-through`), indicando claramente que foi excluído do cálculo.

### Custos extras — novo layout

Remove o card aninhado com header e borda separada. Vira uma seção integrada na lista de saídas:

```
• Custo extra: Gasolina    15/02    -R$ 120    [🗑]
• Custo extra: Almoço      18/02    -R$ 80     [🗑]
  [+ Adicionar custo extra]
```

O botão "+ Adicionar custo extra" fica vermelho/discreto, e o formulário inline abre abaixo, empurrando o conteúdo para baixo.

---

## Redesign da seção ENTRADAS

Mantém a mesma lógica limpa, mas consistentemente verde:

```
┌─────────────────────────────────────────────────────────┐
│  ↓ ENTRADAS                                             │  ← header verde
├─────────────────────────────────────────────────────────┤
│  • Pagamentos recebidos               +R$ 37.920        │  ← verde
│  • Juros recebidos                    +R$ 11.375        │  ← verde
├─────────────────────────────────────────────────────────┤
│  Total entradas                       +R$ 49.295        │  ← verde bold
└─────────────────────────────────────────────────────────┘
```

---

## Saldo Atual

Sem mudanças de estrutura — já funciona bem. Apenas garantir que as cores (verde/vermelho) dependam do resultado calculado (com bills + extras).

---

## Arquivo modificado

### `src/components/reports/CashFlowCard.tsx`

**Mudanças de estrutura:**

1. **Seção Saídas**: Fundo `red-500/5` com borda `red-500/20`. Header com `text-red-500`. Todos os itens usam `text-red-500` para valores negativos.

2. **"Contas a pagar"**: Remove o card com fundo laranja. Vira uma linha na lista, igual às demais. Toggle fica alinhado à direita. Quando desabilitado: valor com `opacity-40 line-through`.

3. **"Custos extras"**: Remove o card aninhado com borda separada. Os itens de custo ficam listados diretamente dentro da seção Saídas, com um pequeno label "custo extra" ou ícone diferenciador. Botão "+ Adicionar" em vermelho claro. Formulário inline mantido, mas com cores vermelhas.

4. **Seção Entradas**: Fundo `emerald-500/5` com borda `emerald-500/20`. Header com `text-emerald-500`. Todos os valores com `text-emerald-500`.

5. **Pontos/bullets**: Todos os itens de saída têm `bg-red-500` no bullet; todos os de entrada têm `bg-emerald-500`.

**Sem mudanças de lógica** — apenas CSS e estrutura JSX.
