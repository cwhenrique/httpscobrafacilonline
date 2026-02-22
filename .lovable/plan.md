
# Corrigir Emojis Quebrados na Mensagem via Link WhatsApp

## Problema
Quando a mensagem e enviada pelo botao "Cobrar via WhatsApp" (link wa.me), os emojis como 📋, 💵, 📊, 📅, 📈, 💳 aparecem como ◆ (losango preto) no WhatsApp do destinatario. Isso acontece em certos dispositivos Android onde a URL curta `wa.me` nao decodifica corretamente caracteres Unicode de 4 bytes (emojis do plano suplementar).

## Causa
A URL `https://wa.me/XXXX?text=...` com emojis codificados via `encodeURIComponent` nao e processada corretamente por algumas versoes do WhatsApp/Android. A URL completa `https://api.whatsapp.com/send` lida melhor com Unicode.

## Solucao

### Arquivo: `src/components/MessagePreviewDialog.tsx`

Trocar a construcao do link de:
```
https://wa.me/${waPhone}?text=${encodeURIComponent(editedMessage)}
```
Para:
```
https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(editedMessage)}
```

A URL `api.whatsapp.com/send` e o endpoint oficial do WhatsApp e lida melhor com caracteres Unicode em todos os dispositivos.

## Resumo
- 1 arquivo modificado: `src/components/MessagePreviewDialog.tsx`
- 1 linha alterada (linha 101)
- Sem alteracao de banco de dados
- Corrige emojis em todas as mensagens enviadas via link (cobrancas, lembretes, etc.)
