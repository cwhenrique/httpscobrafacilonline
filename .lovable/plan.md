
# Plano: Corrigir Exibição de Multa no PDF de Pagamento

## Problema Identificado

Quando o usuário registra um pagamento de parcela que inclui multa, o comprovante PDF pode não mostrar a multa corretamente devido a **dois problemas**:

1. **Altura fixa da caixa**: A caixa "DADOS DO PAGAMENTO" tem altura fixa de 70px, mas quando há multa, total do contrato e total pago, os campos ultrapassam o espaço disponível.

2. **Posicionamento `currentY` fixo**: O incremento `currentY += 80` não considera os campos extras, causando sobreposição de elementos.

## Solução

Tornar a altura da caixa de pagamento **dinâmica**, calculando-a baseada nos campos presentes:

- Campos base: Cliente, Parcela, Data, Valor Pago, Saldo Restante (~70px)
- Multa Inclusa: +10px
- Total do Contrato: +10px  
- Total Pago: +10px

## Alterações Técnicas

### Arquivo: `src/lib/pdfGenerator.ts`

**Linhas ~628-720** - Função `generatePaymentReceipt`

**Antes:**
```typescript
// === PAYMENT INFO ===
doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
doc.setLineWidth(0.5);
doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 70, 2, 2, 'S');
// ... campos ...
currentY += 80;
```

**Depois:**
```typescript
// === PAYMENT INFO ===
// Calcular altura dinâmica baseada nos campos presentes
let paymentBoxHeight = 70; // Altura base
if (data.penaltyAmount && data.penaltyAmount > 0) {
  paymentBoxHeight += 10;
}
if (data.totalContract) {
  paymentBoxHeight += 10;
}
if (data.totalPaid) {
  paymentBoxHeight += 10;
}

doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
doc.setLineWidth(0.5);
doc.roundedRect(margin, currentY, pageWidth - 2 * margin, paymentBoxHeight, 2, 2, 'S');
// ... campos ...
currentY += paymentBoxHeight + 10; // Usar altura calculada + margem
```

## Comportamento Esperado

| Campo | Antes | Depois |
|-------|-------|--------|
| Apenas campos base | Caixa 70px | Caixa 70px |
| Com multa | Conteúdo fora da caixa | Caixa 80px |
| Com multa + totais | Muito conteúdo cortado | Caixa 100px |
| PDF completo | Elementos sobrepostos | Espaçamento correto |

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/pdfGenerator.ts` | Calcular altura dinâmica da caixa de pagamento (~linhas 628-720) |

## Estimativa

- **Complexidade**: Baixa
- **Linhas alteradas**: ~10
- **Risco**: Mínimo (apenas visual do PDF)
- **Testes recomendados**: 
  - Gerar PDF de pagamento SEM multa
  - Gerar PDF de pagamento COM multa
  - Verificar se todos os campos ficam dentro da caixa
