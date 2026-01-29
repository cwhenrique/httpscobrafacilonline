
# Plano: Corrigir Inconsistência de Datas de Parcelas Fora de Ordem

## Problema Identificado

O empréstimo da cliente TAHINA possui datas de parcelas fora de ordem cronológica:

**Array atual no banco:**
```
["2026-01-22", "2026-02-06", "2026-01-25"]
```

**Problema:** A parcela do dia 25/01 está no índice 2 (última posição), mas deveria estar no índice 1 para manter a ordem cronológica.

### Impacto:
- **Calendário de Cobranças**: Itera por todas as datas e identifica a data 25/01 como em atraso (correto visualmente)
- **Página de Empréstimos**: Usa o `status` do empréstimo e lógica de índices sequenciais. Como a parcela 0 (22/01) está paga e a parcela 1 (06/02) é futura, não detecta atraso

## Solução em 2 Partes

### Parte 1: Correção de Dados (Empréstimo da TAHINA)

Executar SQL para corrigir o empréstimo específico:

```sql
-- Corrigir array de datas (ordem cronológica)
UPDATE loans 
SET 
  installment_dates = '["2026-01-22", "2026-01-25", "2026-02-06"]'::jsonb,
  status = 'overdue',
  notes = REPLACE(
    notes, 
    '[INSTALLMENT_DATE_CHANGE:1:2026-02-06:2026-01-22]',
    '[INSTALLMENT_DATE_CHANGE:0:2026-01-22:2026-01-22][DATES_REORDERED]'
  )
WHERE client_id = 'c850300d-6a85-467c-b093-e9f199d3ef2f'
  AND status != 'paid'
  AND installment_dates::text LIKE '%2026-01-22%'
  AND installment_dates::text LIKE '%2026-02-06%';
```

### Parte 2: Correção no Código (Prevenção Futura)

Garantir que ao alterar uma data de parcela, o array seja SEMPRE ordenado cronologicamente.

**Arquivo: `src/pages/Loans.tsx`**

**Função `handleUpdateSpecificDate` (linha ~1684):**

```typescript
// Após atualizar a data no array (linha 1695)
updatedDates[index] = newDateStr;

// 🆕 NOVO: Ordenar o array cronologicamente
const sortedDates = [...updatedDates].sort((a, b) => 
  new Date(a + 'T12:00:00').getTime() - new Date(b + 'T12:00:00').getTime()
);

// Usar sortedDates em vez de updatedDates no restante da função
```

**Considerações para empréstimos diários:**
- Empréstimos diários têm lógica de "cascata" (mover parcelas seguintes)
- Após a cascata, também deve ordenar para garantir consistência

**Atualização no arquivo `src/hooks/useLoans.ts`:**

Na função `renegotiateLoan` (linha ~410), também garantir ordenação:

```typescript
// Antes de salvar installment_dates
installment_dates: data.installment_dates.sort((a, b) => 
  new Date(a + 'T12:00:00').getTime() - new Date(b + 'T12:00:00').getTime()
),
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Banco de Dados** | Corrigir dados do empréstimo da TAHINA |
| `src/pages/Loans.tsx` | Função `handleUpdateSpecificDate` - ordenar array após alteração |
| `src/pages/Loans.tsx` | Função `handleUpdateDueDate` - ordenar array após alteração |
| `src/hooks/useLoans.ts` | Função `renegotiateLoan` - ordenar array antes de salvar |

## Resultado Esperado

### Empréstimo TAHINA após correção:
```
installment_dates: ["2026-01-22", "2026-01-25", "2026-02-06"]
                        ↑ PAGO        ↑ ATRASADO    ↑ ABERTO
```

- ✅ Calendário mostra 25/01 em atraso
- ✅ Página de Empréstimos mostra contrato em atraso
- ✅ Status do empréstimo: `overdue`

### Prevenção Futura:
- Qualquer alteração de data manterá o array em ordem cronológica
- Evita inconsistências entre Calendário e Página de Empréstimos

## Observações Técnicas

- As tags `[PARTIAL_PAID:index:value]` precisam ser reconsideradas se usarmos ordenação dinâmica
- Para manter compatibilidade, a tag `[PARTIAL_PAID:0:...]` continuará referenciando a primeira data **ordenada**
- O pagamento de 22/01 deve continuar marcado como pago (índice 0 no array ordenado)
