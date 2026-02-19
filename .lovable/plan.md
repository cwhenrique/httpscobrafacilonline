
# Corrigir Campo do Body na API Um Clique Digital

## Problema

A API da Um Clique Digital retorna erro 400:
```
{"success":false,"error":"content is required for text messages","code":"MISSING_CONTENT"}
```

O campo enviado no body e `text`, mas a API espera `content`.

## Solucao

Alterar **uma unica linha** no arquivo `supabase/functions/daily-summary/index.ts`:

Linha 71: trocar `text: message` por `content: message`

### Antes
```typescript
body: JSON.stringify({
  channel_id: "1060061327180048",
  to: cleaned,
  type: "text",
  text: message,   // <-- campo errado
}),
```

### Depois
```typescript
body: JSON.stringify({
  channel_id: "1060061327180048",
  to: cleaned,
  type: "text",
  content: message,   // <-- campo correto
}),
```

## Validacao

Apos o deploy, invocar a funcao com `testPhone` para confirmar que o status retorna 200 e `sentCount: 1`.
