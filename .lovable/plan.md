
# Corrigir textos brancos no card diario atrasado (modo claro)

## Problema
No modo claro, o card de emprestimo diario atrasado tem fundo branco mas diversas informacoes usam `text-white` ou `text-white/70`, tornando-as invisiveis. Isso afeta:
- Labels "Emprestado", "Total a Receber", "Lucro Previsto", "Lucro Realizado"
- Data de vencimento ("Venc: 10/02/2026")
- Botoes de acao (Pagar, Historico, Editar, Renegociar, Adicionar Parcela Extra)
- Texto "restante a receber"
- Botoes dentro da area de atraso (Editar Juros, Aplicar Multa)
- Texto de regularizacao

## Causa raiz
Na secao de emprestimos diarios (linha ~10449), a variavel `hasSpecialStyle = isOverdue || isPaid` faz com que cards atrasados recebam os mesmos estilos visuais de cards pagos (que tem fundo escuro). Isso causa `text-white` em elementos sobre fundo branco.

## Solucao
Aplicar a mesma estrategia ja usada nos cards mensais: separar `isPaid` de `isOverdue` para que no modo claro, cards atrasados usem cores escuras.

## Alteracoes tecnicas em `src/pages/Loans.tsx`

### 1. Corrigir `mutedTextColor` (linha 10450)
Mudar de:
```
const mutedTextColor = hasSpecialStyle ? 'text-white/70' : 'text-muted-foreground';
```
Para:
```
const mutedTextColor = isPaid ? 'text-white/70' : 'text-muted-foreground';
```

### 2. Remover `textColor` do Card (linha 10539)
Mudar de:
```
<Card ... className={`... ${textColor}`}>
```
Para:
```
<Card ... className={`... ${isPaid ? textColor : ''}`}>
```

### 3. Corrigir valores "Emprestado" e "Total a Receber" (linhas 10643, 10647)
Adicionar `text-foreground` explicito quando nao e pago.

### 4. Corrigir botoes de acao (linhas 11433-11560)
Em todos os botoes, substituir `hasSpecialStyle` por `isPaid` nas condicoes de estilo:
- Botao "Pagar" (linha 11441)
- Botao "Historico" (linha 11481)
- Botao "Editar" (linha 11497)
- Botao "Renegociar" (linha 11513)
- Botao "Parcelas Extras" (linha 11530)
- Variantes dos botoes (`variant={hasSpecialStyle ? 'secondary' : 'outline'}` → `variant={isPaid ? 'secondary' : 'outline'}`)

### 5. Corrigir borda da area de botoes (linha 11433)
Mudar `hasSpecialStyle ? 'border-t border-white/20'` para `isPaid ? 'border-t border-white/20'`

### 6. Corrigir textos na area de atraso diario
- "Regularize as parcelas" (linha 11257): `text-red-300/60` → `text-red-600 dark:text-red-300/60`
- Botoes "Editar Juros" e "Aplicar Multa" (linhas 11234, 11249): adicionar cores escuras para modo claro
- Cancelar botao (linha 11216): `text-blue-300` → `text-blue-700 dark:text-blue-300`

### 7. Modo escuro preservado
Todas as alteracoes usam prefixo `dark:` para manter os estilos atuais do modo escuro inalterados.
