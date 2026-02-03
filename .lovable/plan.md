
# Plano: Corrigir Mensagens Usando "Restante a Receber" em vez de "Total do Contrato"

## Problema Identificado

Ao enviar relatórios/lembretes automáticos via WhatsApp para os clientes, algumas mensagens estão mostrando o **total do contrato** quando deveriam mostrar o **saldo devedor restante**.

### Exemplo do Erro

Um cliente que pegou R$1.000 emprestados (total do contrato R$1.200) e já pagou R$600 está recebendo mensagens com:

- **Errado**: "Total a Receber: R$1.200,00" (valor total do contrato)
- **Correto**: "Restante a Receber: R$600,00" (saldo devedor atual)

## Arquivos Afetados

### 1. supabase/functions/check-loan-reminders/index.ts

**Linha 279-281** - Seção de valores na lista interativa:
```typescript
// ANTES (errado):
{
  title: "Total a Receber",
  description: formatCurrency(loan.totalToReceive), // mostra total do contrato
  rowId: "total",
},

// DEPOIS (correto):
{
  title: "Restante a Receber",
  description: formatCurrency(loan.remainingBalance), // mostra saldo devedor
  rowId: "remaining",
},
```

**Linha 338** - Descricao da mensagem:
```typescript
// ANTES (correto - rotulo correto):
loanDescription += `💵 *Total Contrato:* ${formatCurrency(loan.totalToReceive)}\n\n`;
// Esta linha esta correta pois usa "Total Contrato" para o valor total
```

### 2. supabase/functions/check-overdue-loans/index.ts

**Linha 457-461** - Secao de valores na lista interativa:
```typescript
// ANTES (errado):
{
  title: "Total a Receber",
  description: formatCurrency(loan.totalToReceive), // mostra total do contrato
  rowId: "total",
},

// DEPOIS (correto):
{
  title: "Restante a Receber",
  description: formatCurrency(loan.remainingBalance), // mostra saldo devedor
  rowId: "remaining",
},
```

## Logica da Correcao

| Campo | Valor | Quando Usar |
|-------|-------|-------------|
| `totalToReceive` | Principal + Juros (total do contrato) | Label "Total Contrato" ou "Valor Total" |
| `remainingBalance` | Saldo devedor atual | Label "Restante a Receber" ou "Saldo Devedor" |

## Mensagens Corrigidas

### Lembrete de Vencimento (check-loan-reminders)

Antes:
```text
💰 Valores
├── Emprestado: R$ 1.000,00
├── Total a Receber: R$ 1.200,00  ❌ (confuso)
└── Taxa de Juros: 20%
```

Depois:
```text
💰 Valores
├── Emprestado: R$ 1.000,00
├── Restante a Receber: R$ 600,00  ✅ (claro)
└── Taxa de Juros: 20%
```

### Alerta de Atraso (check-overdue-loans)

Antes:
```text
💰 Valores
├── Valor Emprestado: R$ 1.000,00
├── Total a Receber: R$ 1.200,00  ❌ (confuso)
└── Taxa de Juros: 20%
```

Depois:
```text
💰 Valores
├── Valor Emprestado: R$ 1.000,00
├── Restante a Receber: R$ 600,00  ✅ (claro)
└── Taxa de Juros: 20%
```

## Implementacao

1. Atualizar `check-loan-reminders/index.ts`:
   - Linha 279: Mudar titulo de "Total a Receber" para "Restante a Receber"
   - Linha 280: Mudar `loan.totalToReceive` para `loan.remainingBalance`

2. Atualizar `check-overdue-loans/index.ts`:
   - Linha 458: Mudar titulo de "Total a Receber" para "Restante a Receber"
   - Linha 459: Mudar `loan.totalToReceive` para `loan.remainingBalance`

3. Fazer deploy das edge functions atualizadas

## Notas Importantes

- O campo `remainingBalance` ja esta sendo passado corretamente nos objetos `loanInfo`
- As descricoes de texto (ex: linha 338 e 544) ja usam labels corretas ("Total Contrato" com `totalToReceive`)
- Apenas as listas interativas do WhatsApp tem o label incorreto
- A correcao e simples: trocar a label e o valor referenciado

