

# Plano: Exibir Multas Aplicadas no PDF do Comprovante de Empréstimo

## Problema Identificado

Quando você baixa o PDF do comprovante de empréstimo, as multas aplicadas às parcelas (R$ 150,00 neste caso) **não aparecem** no documento. 

Isso acontece porque:
1. O PDF de comprovante de empréstimo não foi programado para incluir multas
2. Os dados das multas não são passados para a função que gera o PDF
3. A função não renderiza uma seção de multas

## Solução

Adicionar uma nova seção no PDF de empréstimo mostrando as multas aplicadas e atualizar o "Total a Receber" para incluí-las.

## Alterações Necessárias

### 1. Atualizar Interface `ContractReceiptData`

**Arquivo**: `src/lib/pdfGenerator.ts` (linhas ~99-144)

Adicionar campo para multas aplicadas:

```typescript
export interface ContractReceiptData {
  // ... campos existentes ...
  appliedPenalties?: {
    total: number;
    details?: Array<{
      installmentIndex: number;
      amount: number;
    }>;
  };
}
```

### 2. Passar Multas nos Dados do Comprovante

**Arquivo**: `src/pages/Loans.tsx` (linhas ~4555-4593)

Adicionar o cálculo das multas ao preparar os dados:

```typescript
const receiptData: ContractReceiptData = {
  // ... campos existentes ...
  appliedPenalties: (() => {
    const penalties = getDailyPenaltiesFromNotes(loan.notes);
    const total = Object.values(penalties).reduce((sum, val) => sum + val, 0);
    if (total <= 0) return undefined;
    
    return {
      total,
      details: Object.entries(penalties).map(([idx, amount]) => ({
        installmentIndex: parseInt(idx),
        amount
      }))
    };
  })(),
};
```

### 3. Renderizar Multas no PDF

**Arquivo**: `src/lib/pdfGenerator.ts` (após a seção "DADOS DA NEGOCIAÇÃO", ~linha 432)

Adicionar nova seção quando houver multas:

```typescript
// === MULTAS APLICADAS (se houver) ===
if (data.appliedPenalties && data.appliedPenalties.total > 0) {
  const ORANGE = { r: 234, g: 88, b: 12 }; // #ea580c
  const LIGHT_ORANGE_BG = { r: 255, g: 237, b: 213 }; // #fed7aa
  
  doc.setDrawColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.setFillColor(LIGHT_ORANGE_BG.r, LIGHT_ORANGE_BG.g, LIGHT_ORANGE_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 22, 2, 2, 'FD');

  doc.setTextColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('MULTAS APLICADAS', margin + 5, currentY + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de Multas: ${formatCurrency(data.appliedPenalties.total)}`, margin + 5, currentY + 16);

  currentY += 28;
}
```

### 4. Atualizar Total a Receber

Na seção "DADOS DA NEGOCIAÇÃO", atualizar o valor total para incluir multas:

```typescript
// Total a Receber (incluindo multas se houver)
const totalWithPenalties = data.negotiation.totalToReceive + (data.appliedPenalties?.total || 0);
doc.text('Total a Receber:', col1X, negY);
doc.text(formatCurrency(totalWithPenalties), col1X + 40, negY);

// Se houver multas, mostrar nota explicativa
if (data.appliedPenalties && data.appliedPenalties.total > 0) {
  doc.setFontSize(7);
  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.text(`(inclui ${formatCurrency(data.appliedPenalties.total)} em multas)`, col1X + 90, negY);
}
```

### 5. Atualizar Mensagem WhatsApp (ReceiptPreviewDialog)

**Arquivo**: `src/components/ReceiptPreviewDialog.tsx` (função `generateWhatsAppMessage`, ~linhas 71-171)

Adicionar multas na mensagem:

```typescript
// Após o Total a Receber
if (data.appliedPenalties && data.appliedPenalties.total > 0) {
  message += `⚠️ *Multas Aplicadas: ${formatCurrency(data.appliedPenalties.total)}*\n`;
}
```

## Resultado Esperado

| Campo | Antes | Depois |
|-------|-------|--------|
| PDF mostra multas | ❌ Não | ✅ Seção "MULTAS APLICADAS" |
| Total a Receber | R$ 1.599,99 | R$ 1.749,99 (com multa R$ 150) |
| Mensagem WhatsApp | Sem multas | Inclui "Multas Aplicadas: R$ 150" |
| Nota explicativa | - | "(inclui R$ 150 em multas)" |

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/pdfGenerator.ts` | Adicionar campo na interface + renderizar seção de multas |
| `src/pages/Loans.tsx` | Calcular e passar multas nos dados do comprovante |
| `src/components/ReceiptPreviewDialog.tsx` | Incluir multas na mensagem WhatsApp e preview |

## Estimativa

- **Complexidade**: Média
- **Linhas adicionadas**: ~50
- **Risco**: Baixo (adiciona funcionalidade nova, não altera comportamento existente)
- **Testes recomendados**: 
  - Baixar PDF de empréstimo COM multas → verificar se aparece a seção
  - Baixar PDF de empréstimo SEM multas → verificar se não aparece seção extra
  - Verificar se o Total a Receber inclui as multas

