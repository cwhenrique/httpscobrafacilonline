
# Reorganizar botoes de cobranca WhatsApp

## Problema
Quando a instancia esta conectada e existem parcelas em atraso + vence hoje, aparecem 4 botoes empilhados verticalmente (2 de atraso + 2 de hoje), ocupando muito espaco e ficando visualmente confuso.

## Solucao
Agrupar os botoes em **duas linhas horizontais**, cada uma com o botao de link (wa.me) e o botao de instancia lado a lado, usando cores distintas e labels compactos.

### Layout proposto

```text
Linha 1 (Atraso - Vermelho):
[ Cobrar Atraso (link) ] [ Enviar Cobranca (instancia) ]

Linha 2 (Hoje - Laranja):  
[ Cobrar Hoje (link) ]   [ Cobrar Hoje (instancia) ]

Badge: "Ja cobrou Nx" (se aplicavel)
```

## Mudancas tecnicas

### 1. `SendOverdueNotification.tsx` (linhas 482-529)
- Mudar o container de `flex-col` para `flex flex-row flex-wrap` com `gap-1.5`
- Ambos os botoes ficam na mesma linha, lado a lado
- Reduzir labels: botao link = "Atraso (Link)" / botao instancia = "Enviar Cobranca"
- Manter cores vermelhas para ambos os botoes de atraso

### 2. `SendDueTodayNotification.tsx` (linhas 360-407)
- Mesma mudanca: container `flex flex-row flex-wrap` com `gap-1.5`
- Ambos os botoes ficam na mesma linha
- Reduzir labels: botao link = "Hoje (Link)" / botao instancia = "Cobrar Hoje"
- Manter cores laranjas/amarelas para ambos os botoes de hoje

### Resultado visual
Em vez de 4 botoes empilhados verticalmente, teremos 2 linhas compactas com 2 botoes cada, mantendo a diferenciacao por cor (vermelho = atraso, laranja = hoje) e reduzindo a altura total ocupada pela metade.
