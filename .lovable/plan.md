

## Corrigir tela preta ao clicar no app (usuario badboyinternacional@gmail.com)

### Diagnostico

Investiguei a fundo a conta do usuario:
- Perfil completo (nome, telefone preenchidos)
- Conta ativa, assinatura mensal valida ate 26/02/2026
- Dados dos emprestimos normais (sem valores nulos ou inconsistentes)
- Autenticacao funcionando normalmente
- Nao e funcionario, e dono da conta

**Causa raiz identificada:** O app NAO possui um **ErrorBoundary** (componente React que captura erros de renderizacao). Quando qualquer componente do app sofre um erro JavaScript durante a renderizacao (ex: ao clicar em um botao que abre um dialog, ao navegar entre paginas), o React desmonta TODA a arvore de componentes, resultando em tela preta.

O session replay mostra animacoes SVG (graficos do dashboard carregando) e entao um evento truncado com tamanho grande (37.858 bytes), indicando um crash na renderizacao.

### Plano de correcao

#### 1. Criar um ErrorBoundary global

Criar `src/components/ErrorBoundary.tsx` - um componente class-based que:
- Captura erros de renderizacao em qualquer componente filho
- Exibe uma tela amigavel com mensagem de erro e botao "Recarregar"
- Loga o erro no console para debug
- Permite que o usuario continue usando o app sem ficar preso na tela preta

#### 2. Envolver o app com o ErrorBoundary

Em `src/App.tsx`, envolver o `AppContent` com o novo `ErrorBoundary`:
- Qualquer erro de renderizacao sera capturado e mostrara a tela de fallback
- O usuario podera clicar em "Recarregar" para voltar ao funcionamento normal

#### 3. Adicionar ErrorBoundary no DashboardLayout

Em `src/components/layout/DashboardLayout.tsx`, envolver o `{children}` com outro ErrorBoundary:
- Erros em paginas individuais nao derrubam o layout inteiro (sidebar continua funcionando)
- O usuario pode navegar para outra pagina sem precisar recarregar

### Detalhes tecnicos

- ErrorBoundary precisa ser um Class Component (hooks nao suportam `componentDidCatch`)
- Dois niveis de protecao: global (App) e por pagina (DashboardLayout)
- Tela de fallback com estilo consistente com o tema do app
- Botao de recarregar usa `window.location.reload()`
- Botao de "Voltar ao Dashboard" usa navegacao direta

