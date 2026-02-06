

## Plano: Relatório Diário com Resumo de Atrasados

### Objetivo
Modificar o relatório diário enviado via WhatsApp para:
1. **Manter detalhado** quem vence no dia (nome + valor)
2. **Resumir atrasados** com apenas contagem e total (ex: "4 pessoas em atraso - R$ 2.500,00")
3. Garantir que os dados são buscados frescos antes de cada envio (já funciona assim)

### Formato do Relatório Proposto

```text
📋 *Relatório do Dia*

📅 06/02/2026
━━━━━━━━━━━━━━━━

⏰ *VENCE HOJE*
💵 Total: R$ 1.200,00

📅 *DIÁRIOS* (3)
• João Silva: R$ 150,00
• Maria Souza: R$ 150,00
• Pedro Lima: R$ 150,00
Subtotal: R$ 450,00

💰 *OUTROS EMPRÉSTIMOS* (2)
• Ana Costa (mens): R$ 400,00
• José Santos (quin): R$ 350,00
Subtotal: R$ 750,00

━━━━━━━━━━━━━━━━

🚨 *EM ATRASO*
👥 4 clientes em atraso
💸 Total pendente: R$ 2.580,00

━━━━━━━━━━━━━━━━
CobraFácil - 8h
```

### Alterações Técnicas

**Arquivo:** `supabase/functions/daily-summary/index.ts`

1. **Manter seção "Vence Hoje" detalhada** (linhas 484-534)
   - Continua listando cada cliente com nome + valor
   - Separado por categoria (Diários, Outros, Veículos, Produtos)

2. **Simplificar seção "Em Atraso"** (linhas 537-587)
   - Remover listagem individual de cada cliente atrasado
   - Mostrar apenas:
     - Contagem total de clientes em atraso
     - Valor total em atraso
   - Exemplo: "👥 4 clientes em atraso\n💸 Total pendente: R$ 2.580,00"

3. **Código atualizado para seção de atrasados:**
   ```typescript
   // EM ATRASO - Summary only (no individual listing)
   if (hasOverdue) {
     const totalOverdueClients = overdueLoans.length + overdueVehicles.length + overdueProducts.length;
     
     messageText += `🚨 *EM ATRASO*\n`;
     messageText += `👥 ${totalOverdueClients} cliente${totalOverdueClients > 1 ? 's' : ''} em atraso\n`;
     messageText += `💸 Total pendente: ${formatCurrency(grandTotalOverdue)}\n\n`;
   }
   ```

### Comportamento Mantido
- Os dados são sempre buscados do banco antes de enviar (já implementado)
- Filtro por horário agendado pelo usuário funciona normalmente
- Categorização de diários vs outros tipos continua funcionando
- Veículos e produtos continuam incluídos nos cálculos

