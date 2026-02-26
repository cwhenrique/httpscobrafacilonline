
Objetivo
- Corrigir definitivamente a exclusão de pagamento de sub-parcela para que ela volte a ficar pendente/ativa no card e no modal.

Implementação
1) Atualizar parser de exclusão em `src/hooks/useLoans.ts`
- Trocar lógica de detecção única por parser de múltiplos formatos:
  - `Sub-parcela (Adiant. Pn)`
  - `Pagamento parcial - Parcela n/... Sub-parcela`
  - `Parcela Sub-Pn de m`
  - `Parcelas ..., Sub-Pn de m` (usar `matchAll(/Sub-P(\d+)/g)`).
- Gerar lista de índices de sub-parcela (não apenas um índice) e reverter `ADVANCE_SUBPARCELA_PAID` para `ADVANCE_SUBPARCELA` para cada índice detectado.
- Ajustar guardas para usar essa nova lista (em vez de só `subparcelaPaidMatch`) e evitar cair no bloco de remoção de `PARTIAL_PAID` quando o pagamento excluído era de sub-parcela.

2) Tornar o vínculo pagamento↔sub-parcela explícito em `src/pages/Loans.tsx`
- No fluxo `payment_type === 'installment'` com índices negativos (sub-parcelas), adicionar tags de referência no `paymentNoteWithSnapshot`, ex:
  - `[SUBPARCELA_REF:<originalIndex>:<uniqueId>]`
- Manter compatibilidade com notas antigas (sem referência) no `deletePayment`, usando fallback por texto (`Sub-Pn`) quando a tag nova não existir.

3) Auto-recuperação para casos já quebrados (como o seu atual)
- Criar rotina de reconciliação no fluxo da página de empréstimos:
  - Ler `ADVANCE_SUBPARCELA_PAID` do `notes`.
  - Conferir se existe pagamento correspondente no histórico (priorizando `[SUBPARCELA_REF:...]`, fallback legados).
  - Se não existir, reverter para `ADVANCE_SUBPARCELA` automaticamente e atualizar o empréstimo.
- Executar essa reconciliação ao abrir o modal de pagamento/histórico do empréstimo para corrigir registros órfãos sem intervenção manual.

Detalhes técnicos (curto)
- Arquivos: `src/hooks/useLoans.ts`, `src/pages/Loans.tsx`.
- Estratégia: parser robusto + referência explícita nas notas + reconciliação retroativa.
- Compatibilidade: preservada para pagamentos antigos.

Validação
1) Fluxo legado:
- Criar sub-parcela, pagar por “Parcela” (nota `Parcela Sub-Pn...`), excluir pagamento, confirmar que volta como pendente.
2) Fluxo novo:
- Pagar sub-parcela com nota contendo `[SUBPARCELA_REF]`, excluir e validar reversão exata.
3) Caso já quebrado:
- Abrir o empréstimo com sub-parcela órfã e validar auto-recuperação para estado pendente.
4) Regressão:
- Excluir pagamento de parcela normal e garantir que `PARTIAL_PAID` continua revertendo corretamente.
