
# Corrigir Envio via WhatsApp Cloud API (Meta) - Usar Um Clique Digital

## Problema Identificado

O codigo atual esta enviando via **WhatsApp Cloud API da Meta diretamente** (`graph.facebook.com`), mas a requisicao original era para enviar via **Um Clique Digital** (parceiro). A API da Meta exige janela de 24h para mensagens de texto livre, o que provavelmente esta impedindo a entrega.

Alem disso, o plano aprovado originalmente especificava o uso da **Um Clique Digital API** (endpoint `public-send-message`), nao a API direta da Meta.

## Solucao

Substituir a funcao `sendWhatsAppViaCloudAPI` por `sendWhatsAppViaUmClique` que usa o endpoint correto da Um Clique Digital, igual ao padrao ja existente no `umclique-webhook`.

## Alteracoes

### Arquivo: `supabase/functions/daily-summary/index.ts`

**Substituir a funcao `sendWhatsAppViaCloudAPI` (linhas 46-87) por `sendWhatsAppViaUmClique`:**

```text
const sendWhatsAppViaUmClique = async (phone: string, message: string): Promise<boolean> => {
  const umcliqueApiKey = Deno.env.get("UMCLIQUE_API_KEY");
  if (!umcliqueApiKey) {
    console.error("UMCLIQUE_API_KEY not configured");
    return false;
  }

  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;

  try {
    const response = await fetch(
      'https://cslsnijdeayzfpmwjtmw.supabase.co/functions/v1/public-send-message',
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": umcliqueApiKey,
        },
        body: JSON.stringify({
          channel_id: "1060061327180048",
          to: cleaned,
          type: "text",
          text: message,
        }),
      }
    );

    const data = await response.text();
    console.log(`Um Clique API sent to ${cleaned}:`, response.status, data);
    return response.ok;
  } catch (error) {
    console.error(`Failed to send via Um Clique API to ${cleaned}:`, error);
    return false;
  }
};
```

**Atualizar a chamada na linha 598:**

Trocar `sendWhatsAppViaCloudAPI` por `sendWhatsAppViaUmClique`.

## Por que isso resolve

- A Um Clique Digital e um parceiro oficial da Meta que gerencia templates e janelas de conversa
- O endpoint `public-send-message` da Um Clique ja lida com as regras de template/janela de 24h
- Usa a secret `UMCLIQUE_API_KEY` que ja esta configurada
- Segue o mesmo padrao ja usado no `umclique-webhook`
