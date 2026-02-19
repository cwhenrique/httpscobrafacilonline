

# Simplificar Cards Fechados - Apenas Nome do Plano

## O que muda

Remover a descricao curta dos cards quando estao fechados. O card compacto mostra **somente**:
- Icone do plano
- Chevron (seta)
- Badge com o nome (Mensal, Trimestral, Anual, Vitalicio)
- Badges de destaque que ja existem (MAIS VENDIDO, MELHOR INVESTIMENTO, APENAS 20 VAGAS, ECONOMIZE R$ 191)

A descricao curta ("Ideal para testar...", "Economia garantida...", etc.) sera **removida** completamente dos cards fechados. Ela aparecera apenas quando o card for aberto, junto com precos e funcionalidades.

## Estrutura do card fechado

```text
+----------------------------------+
|  [Icone]              [Chevron]  |
|         [Mensal]                 |
+----------------------------------+
```

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/pages/Plans.tsx` | Remover os blocos `AnimatePresence` que mostram a descricao quando `openPlan !== 'plano'` nos 4 cards (Mensal, Trimestral, Anual, Vitalicio). Mover as descricoes para dentro do bloco expandido, antes dos precos. |

## Detalhes tecnicos

Para cada um dos 4 cards, remover o bloco:
```tsx
<AnimatePresence>
  {openPlan !== 'mensal' && (
    <motion.p ...>Ideal para testar...</motion.p>
  )}
</AnimatePresence>
```

E adicionar a descricao como primeiro elemento dentro do `motion.div` expandido, antes do preco riscado.

Isso deixa o card fechado bem compacto e limpo, mostrando apenas a identidade do plano.

