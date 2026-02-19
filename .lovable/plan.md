

# Nova Landing Page de Planos (/planos)

## Visao Geral

Nova pagina dedicada em `/planos` focada em apresentar os 4 planos do CobraFacil (Mensal, Trimestral, Anual e Vitalicio) com todas as funcionalidades, ancoragem de preco e conversao. A pagina atual `/` continua existindo como esta.

---

## Estrutura da Pagina

### 1. Header fixo
- Logo CobraFacil + botao "Entrar" (link para /auth) + botao "Ver Planos" (scroll para pricing)

### 2. Hero Section (compacta)
- Titulo: "Escolha o Plano Ideal para Voce"
- Subtitulo: "Sistema completo de gestao de emprestimos e cobrancas. Todas as funcionalidades em todos os planos."
- Badge: "Garantia de 7 dias"

### 3. Secao de Planos (4 cards lado a lado)
Grid responsivo: 1 col mobile, 2 col tablet, 4 col desktop

| Plano | Preco | Destaque | Ancoragem |
|---|---|---|---|
| Mensal | R$ 55,90/mes | - | - |
| Trimestral | R$ 149,00/3 meses (R$ 49,67/mes) | Economia 11% | - |
| Anual | R$ 479,00/ano (12x R$ 39,92) | MAIS VENDIDO (card maior, borda primary) | Economize R$ 191 |
| Vitalicio | R$ 999,00 unico | MELHOR INVESTIMENTO (card com gradiente especial) | ~~De R$ 1.499~~ por R$ 999 |

Cada card tera:
- Icone + nome do plano
- Preco principal com ancoragem (vitalicio mostra preco riscado R$ 1.499)
- Preco por mes equivalente
- Badge de destaque (quando aplicavel)
- Lista de funcionalidades incluidas (todas iguais em todos os planos)
- Botao CTA com link Cakto (vitalicio usara placeholder ate voce enviar o link)

### 4. Secao "O que esta incluso"
Grid com todas as funcionalidades com icones:
- Dashboard Inteligente
- Emprestimos ilimitados
- Clientes ilimitados
- Calculo automatico de juros (simples/compostos)
- WhatsApp integrado (alertas + cobrancas)
- Conexao QR Code
- Calendario de cobrancas
- Score de clientes
- Simulador de emprestimos
- Comprovantes PDF
- Contas a pagar/receber
- Venda de produtos e veiculos
- Relatorios detalhados
- Contratos digitais
- Suporte via WhatsApp
- Atualizacoes gratuitas

### 5. Comparativo Visual
Tabela ou grid mostrando:
"Todas as funcionalidades em TODOS os planos. A unica diferenca e o periodo de acesso e o preco."

| Funcionalidade | Mensal | Trimestral | Anual | Vitalicio |
|---|---|---|---|---|
| Todas as funcionalidades | check | check | check | check |
| Periodo | 30 dias | 90 dias | 12 meses | Para sempre |
| Custo mensal | R$ 55,90 | R$ 49,67 | R$ 39,92 | R$ 0 (unico) |

### 6. Secao Garantia
- Garantia incondicional de 7 dias (reutiliza o design ja existente na Landing)

### 7. FAQ especifico de planos
- "Posso trocar de plano depois?"
- "O que acontece quando meu plano vence?"
- "O plano vitalicio realmente nao tem mensalidade?"
- "Todas as funcionalidades estao liberadas em todos os planos?"
- "Como funciona a garantia de 7 dias?"

### 8. CTA Final
- Botao WhatsApp para tirar duvidas
- Botao "Ver planos" (scroll up)

---

## Detalhes Tecnicos

### Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| `src/pages/Plans.tsx` | **NOVO** - Pagina completa de planos |
| `src/App.tsx` | Adicionar rota `/planos` (publica, sem ProtectedRoute) |
| `src/hooks/useAffiliateLinks.ts` | Adicionar campo `lifetime` ao tipo `AffiliateLinks` e aos links default |
| `src/components/PricingSection.tsx` | Adicionar card do plano Vitalicio (4 cards) |

### Logica de links de pagamento
- O `useAffiliateLinks` sera estendido para suportar `lifetime` (link vitalicio)
- Na pagina `/planos`, o botao do Vitalicio usara o link que voce enviar (placeholder por enquanto: botao de WhatsApp "Solicitar Vitalicio")
- Os demais planos usam os links Cakto ja existentes
- Se o usuario estiver logado e tiver afiliado, os links sao substituidos automaticamente (ja funciona assim)

### Design
- Tema escuro (dark mode) consistente com o resto do app
- Animacoes com Framer Motion (fadeInUp)
- Cards com glass effect e bordas primary
- Responsivo: stack vertical no mobile, grid no desktop
- Card do Anual: destaque "MAIS VENDIDO" com borda e sombra
- Card do Vitalicio: destaque "MELHOR INVESTIMENTO" com gradiente dourado/premium e preco riscado de R$ 1.499

### Ancora de preco (Vitalicio)
O card do Vitalicio mostrara:
```
~~R$ 1.499,00~~
R$ 999,00
Pagamento unico, acesso permanente
```

