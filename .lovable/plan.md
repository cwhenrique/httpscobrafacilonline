

# Cards de Plano com Expansao ao Clicar

## O que sera feito

Transformar os 4 cards de plano em componentes expansiveis (accordion-style). Por padrao, cada card mostra apenas um resumo compacto com:
- Icone + nome do plano + uma breve descricao do que e cada plano
- Preco principal com ancoragem (riscado)
- Badge de destaque

Ao clicar no card, ele expande e revela:
- Lista completa de funcionalidades
- Botao CTA de assinatura

## Resumo compacto de cada card (quando fechado)

| Plano | Descricao curta |
|---|---|
| Mensal | Ideal para testar o sistema sem compromisso |
| Trimestral | Economia garantida com 3 meses de acesso |
| Anual | Melhor custo-beneficio, o mais vendido |
| Vitalicio | Pague uma vez, use para sempre |

## Comportamento

- Cards iniciam fechados (compactos)
- Ao clicar em qualquer card, ele expande mostrando funcionalidades + botao CTA
- Apenas UM card aberto por vez (accordion) - ao abrir um, o outro fecha
- Seta/chevron indica que o card e clicavel
- Animacao suave de expansao com Framer Motion (AnimatePresence + motion.div com height auto)
- Os destaques visuais (bordas, gradientes, badges "MAIS VENDIDO" e "MELHOR INVESTIMENTO") continuam visiveis mesmo com o card fechado

## Detalhes Tecnicos

### Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/pages/Plans.tsx` | Adicionar estado `openPlan` para controlar qual card esta aberto; envolver conteudo expandido em AnimatePresence; adicionar ChevronDown com rotacao; adicionar descricao curta visivel quando fechado |

### Implementacao

1. Adicionar estado: `const [openPlan, setOpenPlan] = useState<string | null>(null)`
2. Cada card recebe um `onClick` que alterna `openPlan` entre o id do plano e `null`
3. O conteudo expandivel (lista de funcionalidades + botao CTA) fica dentro de `AnimatePresence` com `motion.div` animando `opacity` e `height`
4. Adicionar icone `ChevronDown` do lucide-react no canto do card, que rotaciona 180 graus quando aberto
5. Quando fechado, mostrar a descricao curta do plano abaixo do preco

### Importacoes adicionais
- `AnimatePresence` do framer-motion (ja importado `motion`)
- `ChevronDown` do lucide-react
