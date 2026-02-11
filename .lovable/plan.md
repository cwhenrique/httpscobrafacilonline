
## Mover o nome do cliente para uma linha propria e centralizada

### Problema
Em monitores com zoom alto, o nome do cliente (ex: "devedor 01") fica espremido na mesma linha dos botoes, mostrando apenas a primeira letra.

### Solucao
Separar o nome do cliente em uma linha dedicada, centralizada, acima dos botoes. Isso garante visibilidade em qualquer tamanho de tela.

### Alteracoes

**1. Card de pasta (ClientLoansFolder.tsx)**
- Mover o nome `group.client.full_name` para uma linha propria, centralizada, abaixo do avatar
- Remover o `truncate` e usar `text-center` com quebra de linha natural (`break-words`)

**2. Card individual de emprestimo - aba Mensal (Loans.tsx ~linha 8351)**
- Separar o nome do cliente dos botoes (Detalhes/Comprovante)
- Nome fica em linha propria centralizada acima dos botoes
- Botoes ficam na linha seguinte

**3. Card individual de emprestimo - aba Diario (Loans.tsx ~linha 10516)**
- Mesma alteracao do card mensal

### Detalhes tecnicos
- Trocar layout de `flex items-center justify-between` (nome + botoes lado a lado) para empilhado
- Nome: `text-center w-full font-semibold text-sm sm:text-lg break-words`
- Botoes: mantidos em linha separada com `flex justify-end`
- Na pasta: nome centralizado abaixo do avatar, badge de status ao lado do avatar
