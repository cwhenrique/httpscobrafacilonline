

# Atualizar Link de Compra na Pagina de Relatorios

## Objetivo
Substituir o link de checkout atual pelo novo link fornecido.

## Alteracao

No arquivo `src/pages/AutoReports.tsx`, trocar a constante `CAKTO_CHECKOUT_URL` de:
```
https://pay.cakto.com.br/DKbJ3gL
```
Para:
```
https://pay.cakto.com.br/3c4qf8i
```

Isso afeta os dois botoes de compra na pagina: o botao no card de status ("Assinar R$ 19,90/mes") e o botao do CTA principal ("Assinar Agora — R$ 19,90/mes").

