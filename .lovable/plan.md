
# Redesign UX/UI do Card "Fluxo de Caixa"

## Problemas identificados

Com base na imagem e no feedback do usuário, os problemas são:

1. **Capital Inicial**: O bloco com borda tracejada azul não comunica claramente que é editável. O ícone de lápis é pequeno e o valor está "perdido" no canto direito. Não há um CTA (call-to-action) claro.

2. **Seção Saídas**: O layout em duas colunas comprimidas (grid-cols-2) deixa o conteúdo da coluna esquerda muito apertado — o toggle de "Contas a pagar", o valor e o formulário de custos extras ficam espremidos. Textos ficam cortados e a hierarquia visual é confusa.

3. **Toggle de Contas a Pagar**: O switch sozinho sem contexto visual claro do que ele ativa/desativa confunde o usuário.

4. **Custos Extras**: O formulário inline dentro de uma coluna estreita é difícil de usar.

---

## Redesign proposto

### Capital Inicial — Novo design

Trocar o bloco genérico por um layout em **duas partes horizontais claramente distintas**:
- À esquerda: label "Capital Inicial" com ícone, e subtexto explicativo
- À direita: o **valor em destaque** + um **botão "Editar" visível** com fundo colorido (não apenas um ícone)

```
┌────────────────────────────────────────────────────────────┐
│  🐷 Capital Inicial                     R$ 38.200,00      │
│  Calculado com base nos empréstimos     [✏ Editar]        │
└────────────────────────────────────────────────────────────┘
```

O botão "Editar" terá fundo `blue-500/20` com borda sólida, tornando o clique muito mais óbvio.

### Saídas — Nova estrutura vertical (sem duas colunas espremidas)

Mudar o layout de **grid-cols-2** para **layout vertical full-width com separação visual clara** entre Saídas e Entradas, usando um divisor horizontal com seta "▼" no meio.

**Layout novo:**

```
┌──────────────────────────────────────────────────────────┐
│ ↑ SAÍDAS                                                 │
│  ──────────────────────────────────────────────────────  │
│  Empréstimos concedidos                   - R$ 31.000    │
│  ──────────────────────────────────────────────────────  │
│  🧾 Contas a pagar                                        │
│     Incluir no cálculo  [toggle]       - R$ 500,00       │
│     3 contas pagas                                        │
│  ──────────────────────────────────────────────────────  │
│  🛍 Custos extras                          - R$ 200      │
│     • Gasolina  15/02  - R$ 120   [🗑]                   │
│     [+ Adicionar custo extra]                             │
│  ──────────────────────────────────────────────────────  │
│  Total saídas                             R$ 31.700      │
└──────────────────────────────────────────────────────────┘

        ▼

┌──────────────────────────────────────────────────────────┐
│ ↓ ENTRADAS                                               │
│  ──────────────────────────────────────────────────────  │
│  Pagamentos recebidos                    + R$ 37.920     │
│  Juros recebidos                         + R$ 11.375     │
│  ──────────────────────────────────────────────────────  │
│  Total entradas                           R$ 49.295      │
└──────────────────────────────────────────────────────────┘
```

### Toggle "Contas a pagar" — Contexto melhorado

O switch agora ficará em uma **linha com label e valor na mesma linha**, mas com um fundo levemente destacado quando ativo (bg-orange-500/10) para comunicar visualmente que está "ligado":

```
┌──────────────────────────────────────────────────────────┐
│  🧾 Contas a pagar   [toggle ON]          - R$ 500,00   │
│     3 contas pagas no período                            │
└────────────── fundo levemente colorido quando ativo ─────┘
```

### Formulário de Custo Extra — Mais espaçoso

Com a mudança para layout vertical full-width, o formulário de custo extra terá espaço suficiente para exibir os campos em uma linha confortável:

```
[ Nome do custo... ]   [ 📅 18/02 ]   [ R$ Valor ]   [✓] [✗]
```

---

## Arquivo modificado

### `src/components/reports/CashFlowCard.tsx`

Apenas este arquivo será modificado. Nenhuma lógica muda — apenas o JSX/CSS.

**Mudanças específicas:**

1. **Capital Inicial**: Adicionar um botão "Editar" visível com texto, substituindo o bloco todo clicável com borda tracejada ambígua. O valor ficará em destaque (`text-2xl font-bold`) e o botão será um `<Button variant="outline" size="sm">` com ícone de lápis + texto "Editar".

2. **Seção Saídas/Entradas**: Mudar de `grid grid-cols-2` para dois blocos empilhados verticalmente — cada um ocupando 100% da largura, separados por um `<ChevronDown>` centralizado. Isso resolve o problema de compressão.

3. **"Contas a pagar" row**: Envolver em um `div` com `rounded-lg p-3` com fundo condicional (`bg-orange-500/10` quando `includeBills = true`, `bg-muted/30` quando false). O switch fica alinhado no lado direito da mesma linha do label.

4. **"Custos extras" form**: Com a largura total, reorganizar o formulário inline para `grid grid-cols-[1fr_auto_auto_auto]` (nome, data, valor, botões) na mesma linha, mais confortável para preencher.

5. **Saldo Atual e Rodapé**: Permanecem iguais — já estão bem posicionados.
