

# Enviar Template Antes do Relatório via Um Clique Digital

## Problema

A API oficial do WhatsApp (Meta) exige que uma conversa seja aberta com um **template aprovado** antes de enviar mensagens de texto livre. Atualmente, o sistema envia diretamente a mensagem de texto, que nao e entregue porque nao ha janela de conversa aberta.

## Solucao

Modificar a funcao `sendWhatsAppViaUmClique` para executar dois passos:

1. **Primeiro**: Enviar o template `relatorio` para abrir a conversa
2. **Segundo**: Aguardar brevemente e enviar a mensagem de texto com o conteudo do relatorio

## Alteracoes

### Arquivo: `supabase/functions/daily-summary/index.ts`

**Reescrever `sendWhatsAppViaUmClique` (linhas 47-83) para:**

```text
1. Enviar template "relatorio" com o nome do usuario como variavel:
   {
     "channel_id": "1060061327180048",
     "to": "5517...",
     "type": "template",
     "template_name": "relatorio",
     "template_language": "pt_BR",
     "template_variables": [
       { "type": "text", "text": "Nome do Usuario" }
     ]
   }

2. Aguardar 2 segundos (para a janela de conversa abrir)

3. Enviar a mensagem de texto com o relatorio:
   {
     "channel_id": "1060061327180048",
     "to": "5517...",
     "type": "text",
     "content": "conteudo do relatorio"
   }
```

**Atualizar a assinatura da funcao** para receber tambem o nome do usuario:

- De: `sendWhatsAppViaUmClique(phone, messageText)`
- Para: `sendWhatsAppViaUmClique(phone, userName, messageText)`

**Atualizar a chamada (linha 595):**

- De: `await sendWhatsAppViaUmClique(profile.phone, messageText)`
- Para: `await sendWhatsAppViaUmClique(profile.phone, profile.full_name || 'Cliente', messageText)`

## Detalhes Tecnicos

- O `full_name` ja e retornado na query de perfis (linha 194)
- O delay de 2 segundos entre template e texto garante que a janela de conversa esteja aberta
- Se o template falhar, a funcao retorna `false` sem tentar enviar o texto
- Se o template for enviado mas o texto falhar, retorna `false` (relatorio nao entregue)
