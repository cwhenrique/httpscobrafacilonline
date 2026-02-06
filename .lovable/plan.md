

# Plano: Atualizar Chave da Evolution API

## Objetivo

Atualizar o secret `EVOLUTION_API_KEY` no Supabase para o novo valor:
```
429683C4C977415CAAFCCE10F7D57E11
```

## Ação Necessária

| Secret | Valor Atual | Novo Valor |
|--------|-------------|------------|
| `EVOLUTION_API_KEY` | (valor anterior) | `429683C4C977415CAAFCCE10F7D57E11` |

## Impacto

Esta chave é utilizada por todas as Edge Functions de WhatsApp:
- `whatsapp-get-qrcode`
- `whatsapp-check-status`
- `whatsapp-create-instance`
- `whatsapp-force-reset`
- `whatsapp-disconnect`
- `send-whatsapp`
- `send-whatsapp-cobrafacil`
- `check-trial-expiring`
- `check-subscription-expiring`
- E outras funções de notificação

## Execução

Ao aprovar, vou solicitar a atualização do secret através do painel de secrets do Lovable Cloud.

