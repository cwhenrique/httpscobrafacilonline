
# Plano: Atualizar EVOLUTION_API_KEY

## Ação Necessária

A atualização do secret `EVOLUTION_API_KEY` precisa ser feita manualmente através da interface do Lovable Cloud.

## Como Atualizar

1. **Acesse as configurações do backend** clicando no botão abaixo
2. **Navegue até a seção de Secrets/Variáveis de Ambiente**
3. **Localize** `EVOLUTION_API_KEY`
4. **Atualize o valor para:** `429683C4C977415CAAFCCE10F7D57E11`
5. **Salve** as alterações

## Após a Atualização

As Edge Functions que utilizam essa chave serão automaticamente atualizadas:
- `send-whatsapp`
- `send-whatsapp-cobrafacil`
- `send-whatsapp-to-client`
- `send-whatsapp-to-self`
- `whatsapp-create-instance`
- `whatsapp-get-qrcode`
- `whatsapp-check-status`
- `daily-summary`
- `morning-greeting`
- E outras funções de notificação

## Teste Recomendado

Após atualizar, teste enviando uma mensagem de teste na página de Perfil para confirmar que a nova API key está funcionando.
