
# Correcao de Visibilidade dos Cards de Emprestimo em Atraso no Modo Claro

## Problema

No modo claro, os cards de emprestimos em atraso (diario e normal) ficam com texto ilegivel:
- Texto branco (`text-white`) sobre fundo vermelho/gradiente avermelhado
- Texto `text-red-300` (vermelho claro) sobre fundo vermelho -- impossivel de ler
- Badges com cores claras (`text-destructive`, `text-amber-300`) sobre fundos coloridos

O modo escuro deve permanecer **inalterado**.

## Solucao

Adicionar variantes `dark:` para manter o estilo escuro atual e usar cores de alto contraste no modo claro para os cards em atraso.

### Arquivos a editar

**`src/pages/Loans.tsx`** - 2 secoes de `getCardStyle` e `textColor`:

**1. Cards de emprestimo normal (linha ~8305)**

Alterar os estilos de overdue para usar fundo mais suave no light mode com texto escuro:

| Situacao | Light (novo) | Dark (mantido) |
|----------|-------------|----------------|
| Daily + overdue | `bg-red-50 border-red-300` | `dark:from-red-500/40 dark:to-blue-500/40` |
| Weekly + overdue | `bg-red-50 border-red-300` | `dark:from-red-500/40 dark:to-orange-500/40` |
| Biweekly + overdue | `bg-red-50 border-red-300` | `dark:from-red-500/40 dark:to-cyan-500/40` |
| Generic overdue | `bg-red-50 border-red-300` | `dark:bg-red-500/30 dark:border-red-400` |
| textColor overdue | `text-red-700` | `dark:text-red-300` |

**2. Cards de emprestimo diario (linha ~10524)**

| Situacao | Light (novo) | Dark (mantido) |
|----------|-------------|----------------|
| Overdue | `bg-red-50 border-red-300 border-l-4 border-l-red-500` | `dark:from-red-500/80 dark:to-blue-500/80 dark:text-white` |
| textColor overdue | `text-red-700` | `dark:text-red-300` |

**3. Badges de status nos cards**

Atualizar os badges "Atrasado" para usar cores legiveis no light mode:
- Light: `bg-red-100 text-red-700 border-red-300`
- Dark: manter `dark:bg-destructive/10 dark:text-destructive dark:border-destructive/20`

### Principio

No modo claro, cards em atraso usarao:
- Fundo: `bg-red-50` (branco rosado, suave)
- Borda: `border-red-300` com `border-l-4 border-l-red-500` (barra lateral vermelha forte)
- Texto principal: `text-red-700` (vermelho escuro, alto contraste)
- Texto secundario: `text-gray-700` (escuro, legivel)

Isso segue o padrao ja documentado na memoria do projeto: "fundo branco solido com borda lateral colorida e texto de alto contraste" para o modo claro.

### Secao tecnica

As mudancas sao concentradas em `src/pages/Loans.tsx` nas duas funcoes `getCardStyle()`:
- Linha ~8305 (emprestimos normais)
- Linha ~10524 (emprestimos diarios)

E nas linhas de `textColor`:
- Linha ~8370 (normais)
- Linha ~10536 (diarios)

Cada estilo sera modificado para adicionar prefixos `dark:` nos estilos atuais e novos estilos sem prefixo para o modo claro.
