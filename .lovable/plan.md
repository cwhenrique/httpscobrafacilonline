

# Enviar Relatorios via Um Clique Digital (API Oficial WhatsApp)

## Resumo

Modificar a edge function `daily-summary` para que usuarios com `relatorio_ativo = true` recebam o relatorio via **Um Clique Digital API** (API oficial do WhatsApp) em vez da Evolution API. Apenas usuarios com o painel ativo utilizarao este canal.

## Alteracoes

### Arquivo: `supabase/functions/daily-summary/index.ts`

**1. Nova funcao `sendWhatsAppViaUmClique`**
- Envia mensagem de texto via endpoint `public-send-message` da Um Clique Digital
- Usa a secret `UMCLIQUE_API_KEY` (ja configurada)
- Formato: tipo `text` com `channel_id` e telefone formatado com codigo 55

**2. Modificar `sendWhatsAppToSelf`**
- Verificar se o usuario tem `relatorio_ativo = true`
- Se sim, enviar via `sendWhatsAppViaUmClique` usando o telefone do perfil (`profile.phone`)
- Se nao, manter o envio via Evolution API (comportamento atual para outros tipos de mensagem)

**3. Modificar a query de perfis**
- Incluir o campo `relatorio_ativo` na consulta
- Para usuarios com `relatorio_ativo`, nao exigir `whatsapp_instance_id` e `whatsapp_connected_phone`
- Separar a query: buscar usuarios com WhatsApp conectado OU com `relatorio_ativo = true`

**4. Logica de decisao**

```text
Se relatorio_ativo = true:
  -> Enviar via Um Clique Digital API (telefone do perfil)
Se relatorio_ativo = false e tem WhatsApp conectado:
  -> Enviar via Evolution API (comportamento atual)
Se nenhum:
  -> Pular usuario
```

### Detalhes da API Um Clique Digital

Baseado no padrao ja existente em `umclique-webhook`:

```text
POST https://cslsnijdeayzfpmwjtmw.supabase.co/functions/v1/public-send-message
Headers:
  Content-Type: application/json
  X-API-Key: {UMCLIQUE_API_KEY}
Body:
  {
    "channel_id": "1060061327180048",
    "to": "5515981046991",
    "type": "text",
    "text": "conteudo do relatorio"
  }
```

### Impacto

- Usuario Henrique (clau_pogian@hotmail.com) passara a receber relatorios via API oficial
- Usuarios sem `relatorio_ativo` continuam usando Evolution API normalmente
- O botao "Enviar Relatorio de Teste" tambem passara a usar Um Clique para usuarios com painel ativo

