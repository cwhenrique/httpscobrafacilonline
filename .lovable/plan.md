

# Adicionar Informação de Suporte via WhatsApp

## O que será feito

Adicionar uma seção visual entre os cards de planos e a tabela comparativa informando que **todos os planos incluem suporte via WhatsApp das 9h às 20h**.

## Layout

```text
+--------------------------------------------------+
|  [MessageCircle]  Suporte via WhatsApp            |
|  Todos os planos incluem atendimento              |
|  de segunda a sexta, das 09h às 20h               |
+--------------------------------------------------+
```

Um card compacto com ícone do WhatsApp, texto claro e visual destacado (borda verde, fundo sutil).

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/pages/Plans.tsx` | Adicionar uma seção entre os cards de planos (linha ~441) e a tabela comparativa com um card informativo sobre o suporte via WhatsApp incluído em todos os planos |

## Detalhes técnicos

- Usar o mesmo padrão `motion.div` com `fadeInUp` para animação consistente
- Card com `border-green-500/30 bg-green-500/5` para visual associado ao WhatsApp
- Ícone `MessageCircle` ou `Headphones` com cor verde
- Texto: "Suporte via WhatsApp" como título e "Todos os planos incluem atendimento de segunda a sexta, das 09h às 20h" como descrição
- Posicionado logo após a seção dos cards de planos, antes da tabela comparativa
