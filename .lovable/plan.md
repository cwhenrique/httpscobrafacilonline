
# Adicionar Etiqueta "Novidade" no Fluxo de Caixa

## Objetivo

Adicionar um badge/etiqueta de "Novidade" ao lado do título "Fluxo de Caixa" para destacar que é um recurso novo e chamar a atenção dos usuários.

## Implementação

### Arquivo: `src/components/reports/CashFlowCard.tsx`

**Alterações:**

1. Importar o componente `Badge` existente
2. Adicionar o badge "Novidade" ao lado do título em ambos os estados (bloqueado e desbloqueado)

**Mudança no import (linha 2):**
```typescript
import { Badge } from '@/components/ui/badge';
```

**Mudança no título - Estado Bloqueado (linha 49-52):**
```typescript
<CardTitle className="text-lg sm:text-xl flex items-center gap-2">
  <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
  Fluxo de Caixa
  <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 animate-pulse">
    Novidade
  </Badge>
</CardTitle>
```

**Mudança no título - Estado Desbloqueado (linha 126-129):**
```typescript
<CardTitle className="text-lg sm:text-xl flex items-center gap-2">
  <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
  Fluxo de Caixa
  <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 animate-pulse">
    Novidade
  </Badge>
</CardTitle>
```

## Visual

O badge terá:
- Fundo verde (emerald-500) para destaque positivo
- Texto branco para contraste
- Tamanho pequeno (10px) para não poluir o layout
- Animação de pulse sutil para chamar atenção

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `src/components/reports/CashFlowCard.tsx` | Adicionar Badge "Novidade" no título |

## Resultado

O card de Fluxo de Caixa exibirá uma etiqueta verde pulsante "Novidade" ao lado do título, destacando visualmente que é um recurso novo do sistema.
