

# Corrigir Mensagens de Erro do Teste de WhatsApp

## Problema

Após a migração do "WhatsApp para Clientes" para a página Meu Perfil, as mensagens de erro da função `handleTestWhatsApp` ainda referenciam "configurações" ao invés da seção correta que agora está na mesma página.

**Mensagens atuais incorretas:**
- `"Conecte seu WhatsApp nas configurações primeiro"` (linha 551)
- `"WhatsApp não conectado. Conecte nas configurações."` (linha 569)

## Solução

Atualizar as mensagens de erro para referenciar corretamente a seção "WhatsApp para Clientes" que agora está na mesma página, acima do botão de teste.

## Alterações Técnicas

### Arquivo: `src/pages/Profile.tsx`

**1. Linha 551 - Erro de validação inicial:**
```typescript
// De:
toast.error('Conecte seu WhatsApp nas configurações primeiro');

// Para:
toast.error('Conecte seu WhatsApp na seção acima primeiro');
```

**2. Linha 569 - Erro de resposta da edge function:**
```typescript
// De:
toast.error('WhatsApp não conectado. Conecte nas configurações.');

// Para:
toast.error('WhatsApp não conectado. Conecte na seção acima.');
```

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Profile.tsx` | Atualizar 2 mensagens de erro para referenciar "seção acima" ao invés de "configurações" |

## Resultado

Quando o usuário clicar em "Teste de Notificações WhatsApp" sem estar conectado, receberá uma mensagem clara indicando que deve conectar na seção acima (WhatsApp para Clientes), que agora está na mesma página de Perfil.

