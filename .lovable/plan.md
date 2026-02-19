

# Cards Fechados sem Preço - Só Nome + Descrição

## O que muda

Quando o card estiver **fechado**, ele mostra apenas:
- Ícone do plano
- Nome (Mensal, Trimestral, Anual, Vitalício)
- Descrição curta do plano
- Badges de destaque (MAIS VENDIDO, etc.)
- Seta indicando que é clicável

Quando o card for **clicado e abrir**, aí sim aparece:
- Preço riscado (ancoragem)
- Preço real
- Badge de economia
- Lista de funcionalidades
- Botão CTA

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/pages/Plans.tsx` | Mover toda a seção de preços para dentro do bloco expandível (AnimatePresence), deixando visível apenas ícone + nome + descrição quando fechado |

## Estrutura do card fechado (compacto)

```text
+----------------------------------+
|  [Ícone]              [Chevron]  |
|  Badge: Mensal                   |
|  Ideal para testar sem           |
|  compromisso                     |
+----------------------------------+
```

## Estrutura do card aberto (expandido)

```text
+----------------------------------+
|  [Ícone]              [Chevron]  |
|  Badge: Mensal                   |
|  ~~R$ 69,90~~                    |
|  R$ 55,90 /mês                   |
|  Economize R$ 14                 |
|  - Funcionalidade 1              |
|  - Funcionalidade 2              |
|  ...                             |
|  [Assinar Mensal]                |
+----------------------------------+
```

## Detalhes técnicos

Para cada um dos 4 cards:
1. Mover os elementos de preço (line-through, preço principal, texto "por mês", badge economia) para DENTRO do `motion.div` que é controlado pelo `openPlan`
2. A descrição curta fica visível APENAS quando fechado (já funciona assim)
3. O conteúdo expandido passa a incluir: preços + funcionalidades + botão CTA

Os badges de destaque do card (MAIS VENDIDO, MELHOR INVESTIMENTO, APENAS 20 VAGAS) continuam visíveis mesmo com o card fechado.
