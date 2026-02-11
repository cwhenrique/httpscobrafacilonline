

## Reorganizar layout do card de pasta

### Problema atual
O nome do cliente nao fica centralizado porque o avatar e os badges estao na mesma linha, empurrando o nome para o lado.

### Solucao
Inverter a ordem: nome do cliente primeiro (centralizado, fonte maior), avatar e badges abaixo.

### Alteracoes em `src/components/ClientLoansFolder.tsx`

**Estrutura atual (linhas ~125-155):**
1. Avatar + Badges (mesma linha)
2. Nome do cliente
3. Valor restante

**Nova estrutura:**
1. Nome do cliente - centralizado, fonte maior (`text-base sm:text-lg`)
2. Avatar + Badge de pasta + Badge de status (linha abaixo)
3. Valor restante

### Detalhes tecnicos
- Mover o `<p>` do nome para ANTES do bloco do avatar
- Aumentar fonte: `text-base sm:text-lg font-bold`
- Manter `text-center w-full break-words`
- Avatar + badges ficam centralizados abaixo do nome com `flex items-center justify-center gap-2`
