

## Atualizar chave da Evolution API

### O que sera feito

1. **Atualizar o secret `EVOLUTION_API_KEY`** com o novo valor `429683C4C977415CAAFCCE10F7D57E11`

2. **Re-deploy das edge functions** que utilizam a Evolution API para garantir que pegem o novo valor:
   - `whatsapp-get-qrcode`
   - `whatsapp-check-status`
   - `whatsapp-create-instance`
   - `send-whatsapp`
   - `send-whatsapp-cobrafacil`
   - `send-whatsapp-to-client`
   - `send-whatsapp-to-self`
   - `send-test-whatsapp`
   - `send-test-message`
   - `check-trial-expiring`
   - `check-subscription-expiring`
   - E demais funcoes que referenciam `EVOLUTION_API_KEY`

### Resultado esperado

Todas as funcoes de WhatsApp passarao a autenticar com a nova chave, resolvendo possiveis erros 401/403 que estejam ocorrendo com a chave anterior.

