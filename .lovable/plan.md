
## Agrupar Emprestimos por Cliente em Pastas Compactas (Tamanho Normal de Card)

### Situação Atual
- Empréstimos são renderizados em um grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` na linha 10195
- Cada empréstimo ocupa um card individual
- ClientLoansFolder já existe, mas foi projetado para ocupar linha inteira quando expandido

### Mudança Solicitada
O usuário quer que:
1. **Pasta ocupe tamanho normal de um card** (não linha inteira) - se comportar como um card individual no grid
2. **Texto do card mostrar** algo como "x empréstimos de [Cliente]" em vez de todos os detalhes
3. **Cores dinâmicas baseadas no status do grupo** - vermelho se tem atraso, amarelo se vence hoje, verde se quitado
4. **Ao expandir**, mostrar os cards individuais dos empréstimos dentro (possivelmente em um layout diferente, mas sem ocupar a linha inteira do grid pai)

### Solução Técnica

**1. Modificar ClientLoansFolder.tsx**
- Remover estilos que fazem o card ocupar a linha inteira
- Simplificar o header para modo "compacto" quando não expandido:
  - Mostrar: avatar + "x empréstimos de [Cliente]" + badge de status
  - Remover: mostrar todos os totais (totalPrincipal, totalToReceive, etc.) - apenas resumo na linha
- Ao expandir, conteúdo cresce apenas dentro do card (sem modal ou overlay)
- Aplicar cores de border/bg baseadas em status: 
  - Red/destructive se `hasOverdue`
  - Amber/warning se `hasPending` (vence hoje ou em breve)
  - Green/primary se `allPaid`

**2. Modificar src/pages/Loans.tsx (renderização)**
- Adicionar `useMemo` para agrupar `sortedLoans` por `client_id`
- Criar estado `expandedFolders: Set<string>` para rastrear quais pastas estão abertas
- Na renderização do grid:
  - Iterar sobre grupos (ao invés de loans individuais)
  - Se `group.loans.length >= 2`: renderizar `ClientLoansFolder`
  - Se `group.loans.length === 1`: renderizar o card individual normal (sem pasta)
  - Manter estrutura do grid original `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

**3. Conteúdo Expandido**
- Dentro da pasta, mostrar os cards individuais em grid `grid-cols-1 gap-3` ou similar
- Usar a função `renderLoanCard` existente para gerar cada card individual
- Altura da pasta cresce conforme necessário (sem limite fixo)

### Cores e Indicadores
```text
Status Compacto (Header do Card):
- Atrasado (hasOverdue): border-destructive/50, bg-red-500/5 ou similar
- Vence em Breve (hasPending & isDueToday): border-amber-500/50, bg-amber-500/5
- Quitado (allPaid): border-primary/50, bg-primary/5

Badge de Quantidade:
- Mostrar "2 empréstimos", "3 empréstimos", etc.

Ícone da Pasta:
- FolderOpen quando recolhido
- ChevronDown/ChevronUp para expandir
```

### Fluxo do Usuário
1. Usuário vê pasta compacta com "2 empréstimos de João" em vermelho se tem atraso
2. Clica na pasta (ou no ícone de expand)
3. Pasta expande e mostra os 2 cards individuais dentro
4. Usuário interage com os cards normalmente
5. Clica novamente para recolher

### Sequência de Implementação
1. Modificar `ClientLoansFolder.tsx` para modo compacto
2. Adicionar lógica de agrupamento em `src/pages/Loans.tsx` (useMemo)
3. Adicionar estado `expandedFolders` em `src/pages/Loans.tsx`
4. Modificar renderização do grid para usar grupos ao invés de loans diretos
5. Testar com múltiplos empréstimos do mesmo cliente

### Estrutura Visual Final
```text
Grid (3 colunas em desktop):
┌─────────────────┬─────────────────┬─────────────────┐
│ [📁 2 emprés.] │ [Card Normal]    │ [Card Normal]   │
│   de João       │                 │                 │
│   [EXPANDIR ▼]  │                 │                 │
├─────────────────┤                 │                 │
│ [Card 1]        │                 │                 │
│ [Card 2]        │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

A pasta ocupa o mesmo espaço de um card normal. Quando expandida, cresce para acomodar os cards internos.
