

# Webhook para Um Clique Digital - Resposta de Relatorio (Sim/Nao)

## Objetivo

Criar uma edge function que recebe mensagens vindas da plataforma Um Clique Digital (connect.umcliquedigital.com). Quando o usuario/cliente responder "sim", o sistema envia o relatorio. Quando responder "nao", marca como recusado e nao envia.

## Como funciona

```text
Um Clique Digital                Edge Function              Banco de Dados
     |                               |                           |
     |--- POST /umclique-webhook --->|                           |
     |    (mensagem do cliente)      |                           |
     |                               |-- busca pending_messages--|
     |                               |<-- mensagem pendente -----|
     |                               |                           |
     |                    [sim?] --->|-- marca "confirmed" ----->|
     |                               |-- envia relatorio ------->|
     |                               |                           |
     |                    [nao?] --->|-- marca "declined" ------>|
     |                               |  (nao envia nada)         |
     |                               |                           |
     |<--- 200 OK ------------------|                           |
```

## Mudancas

### 1. Nova Edge Function: `supabase/functions/umclique-webhook/index.ts`

A funcao recebe o webhook da plataforma Um Clique Digital. Como e parceira oficial do Meta, o formato do payload segue o padrao da API oficial do WhatsApp (Meta Cloud API) ou o formato proprio da plataforma.

A funcao:

- Aceita POST sem JWT (webhook externo)
- Aceita GET para validacao do webhook (Meta envia um challenge de verificacao)
- Extrai o numero do remetente e o texto da mensagem
- Normaliza o texto e verifica se e "sim" ou "nao"
- Busca na tabela `pending_messages` uma mensagem pendente para aquele telefone
- Se **sim**: marca como `confirmed`, envia o relatorio via `send-whatsapp-to-client`
- Se **nao**: marca como `declined`, nao envia nada
- Loga tudo para debug

**Keywords de confirmacao** (reutiliza a mesma lista do webhook existente):
`ok, sim, confirmo, receber, quero, aceito, 1, yes, si, pode, manda, enviar, blz, beleza, ta, certo, positivo`

**Keywords de recusa** (novo):
`nao, não, 2, no, nope, recuso, cancelar, cancela, para, parar, sair`

### 2. Atualizar `supabase/config.toml`

Adicionar:
```toml
[functions.umclique-webhook]
verify_jwt = false
```

### 3. Nenhuma mudanca no banco de dados

A tabela `pending_messages` ja tem o campo `status` que aceita qualquer string. Vamos usar `declined` para respostas negativas, alem dos existentes `pending`, `confirmed`, `failed`, `expired`.

## Detalhes tecnicos da Edge Function

### Formato esperado do webhook (Meta Cloud API / Um Clique Digital)

A plataforma pode enviar no formato Meta padrao:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5517999999999",
          "text": { "body": "sim" },
          "type": "text"
        }]
      }
    }]
  }]
}
```

Ou no formato simplificado da propria plataforma. A funcao vai tentar ambos os formatos para garantir compatibilidade.

### Validacao do Webhook (GET)

O Meta exige que o endpoint responda a um GET com o `hub.challenge` para validar o webhook. A funcao responde automaticamente a esse desafio.

### Fluxo de "nao"

Quando o cliente responde "nao":
1. Busca a `pending_message` pendente
2. Atualiza status para `declined`
3. Registra `confirmed_at` com a data atual (para auditoria)
4. Retorna sucesso sem enviar mensagem

### Seguranca

A funcao pode opcionalmente validar um token de verificacao configurado na plataforma Um Clique Digital (via header ou query param). Isso sera configuravel via secret `UMCLIQUE_VERIFY_TOKEN`.

## URL do webhook para configurar na plataforma

Apos deploy, a URL sera:
`https://yulegybknvtanqkipsbj.supabase.co/functions/v1/umclique-webhook`

Esta URL deve ser adicionada na configuracao de "Webhook Split" da plataforma Um Clique Digital.
