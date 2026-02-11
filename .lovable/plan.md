
## Atualizar link de compra do Desconto de Cheque

### O que muda
- O botao de compra na tela bloqueada do Desconto de Cheque deixara de apontar para WhatsApp e passara a abrir o link de pagamento do Cakto: `https://pay.cakto.com.br/m2z4unj`
- Sera adicionada uma nota informando que ao comprar com o email da conta, a funcionalidade e liberada automaticamente
- O texto do botao sera ajustado para refletir que e um pagamento mensal

### Detalhes tecnicos

**Arquivo:** `src/pages/CheckDiscounts.tsx` (linhas 186-246)

1. Remover as variaveis de WhatsApp (`whatsappNumber`, `whatsappMessage`, `whatsappUrl`)
2. Substituir o link do botao para `https://pay.cakto.com.br/m2z4unj`
3. Atualizar o texto de preco de "pagamento unico" para "mensal" (R$ 19,90/mes)
4. Trocar o icone do botao de `MessageCircle` (WhatsApp) para `CreditCard` ou `ExternalLink`
5. Adicionar texto informativo abaixo do botao: "Ao efetuar a compra com o email da sua conta, a funcionalidade e liberada automaticamente"
