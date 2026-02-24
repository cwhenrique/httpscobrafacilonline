

# Correcao: Mostrar TODAS as parcelas sempre no status

## Problema
O sistema atual limita a exibicao das parcelas:
- Mais de 60: mostra resumo inteligente (ultimas 3 pagas + 5 pendentes)
- Mais de 180: mostra apenas numeros

Voce quer que a lista completa apareca **sempre**, independente da quantidade de parcelas, em emprestimos, vendas de produtos e todos os comprovantes.

## Solucao

### Arquivo: `src/lib/messageUtils.ts`

Simplificar a funcao `generateInstallmentStatusList` removendo toda a logica de resumo (smart summary e numeric summary). A funcao vai sempre listar TODAS as parcelas com seus emojis de status, sem nenhum limite.

- Remover as funcoes auxiliares `countInstallmentsByStatus`, `generateNumericSummary` e `generateSmartSummary` (linhas 129-222)
- Remover os blocos condicionais de `totalCount > 180` e `totalCount > 60` (linhas 234-242)
- Manter apenas o loop que lista todas as parcelas com emojis

### Arquivo: `src/lib/installmentStatusUtils.ts`

Este arquivo tambem tem funcoes de lista compacta (`generateCompactInstallmentsStatusList`) com limite de 6 parcelas. Remover esse limite para consistencia -- sempre mostrar todas.

### Arquivo: `src/components/SaleCreatedReceiptPrompt.tsx`

Ja mostra todas as parcelas no comprovante de vendas, sem limite. Nenhuma alteracao necessaria.

### Resultado esperado

Toda mensagem de cobranca, comprovante ou recibo vai exibir a lista completa de parcelas no formato:
```
1️⃣ ✅ 19/02/2026 - Paga
2️⃣ ✅ 20/02/2026 - Paga
3️⃣ ❌ 22/02/2026 - Em Atraso (1d)
4️⃣ ⏳ 24/02/2026 - Em Aberto
...
```

Independente de serem 10, 60, 90 ou 120 parcelas.

