

# Melhorar UI dos Cards Fechados

## Problema atual

Os cards fechados tem layout inconsistente: icone e chevron desalinhados, badges de destaque (APENAS 20 VAGAS, ECONOMIZE R$ 191) aparecendo no card fechado do Anual ocupando espaco desnecessario, e o layout geral nao fica uniforme entre os 4 cards.

## O que sera feito

Redesenhar os 4 cards fechados para ficarem limpos, alinhados e uniformes:

```text
+------------------------------------------+
|   [Icone]     Mensal          [Chevron]   |
+------------------------------------------+
```

Layout horizontal em uma unica linha:
- Icone a esquerda
- Nome do plano (badge) centralizado
- Chevron a direita
- Tudo alinhado verticalmente no centro

Para os cards Anual e Vitalicio, as badges de destaque (APENAS 20 VAGAS, ECONOMIZE R$ 191) serao movidas para dentro do bloco expandido, junto com precos e funcionalidades.

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/pages/Plans.tsx` | Reestruturar o layout dos 4 cards fechados para usar `flex items-center justify-between` em uma unica linha horizontal. Mover badges extras do Anual para dentro do bloco expandido. |

## Detalhes tecnicos

Para cada card, o conteudo visivel quando fechado sera simplificado para:

```tsx
<div className="flex items-center justify-between w-full">
  <div className="w-10 h-10 rounded-full flex items-center justify-center ...">
    <Icon className="w-5 h-5" />
  </div>
  <Badge>Nome do Plano</Badge>
  <ChevronDown />
</div>
```

Mudancas especificas:
1. **Mensal/Trimestral**: Remover `text-center mb-4` wrapper, usar flex horizontal
2. **Anual**: Mover o bloco com badges "APENAS 20 VAGAS" e "ECONOMIZE R$ 191" para dentro do `motion.div` expandido
3. **Vitalicio**: Mesmo tratamento - layout horizontal simples
4. Remover `mb-3` e `mb-4` extras que criam espacamento vertical desnecessario nos cards fechados
5. O banner superior (MAIS VENDIDO / MELHOR INVESTIMENTO) continua visivel nos cards Anual e Vitalicio

