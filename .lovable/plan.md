

## Adicionar opção "% do valor total" nos juros por atraso

### O que muda

Adicionar uma terceira opção de tipo de juros por atraso: **"% do valor total"**. Quando o usuario define ex: 30%, o sistema divide por 30 dias = 1% ao dia aplicado sobre o valor total do contrato.

### Como funciona

- Tipo atual `percentage`: X% da **parcela** por dia
- Tipo atual `fixed`: R$ fixo por dia
- **Novo tipo `percentage_total`**: X% do **valor total do contrato**, dividido por 30 (dias no mes), aplicado por dia de atraso

Exemplo: Contrato de R$ 1.728,00, taxa 5% do valor total -> 5% / 30 = 0,1667% ao dia -> R$ 2,88/dia de atraso

### Detalhes Tecnicos

**Tag no banco:** `[OVERDUE_CONFIG:percentage_total:5]` (novo tipo)

**Arquivos a alterar:**

1. **`src/pages/Loans.tsx`** (~8 pontos)
   - Tipo do state `overdueInterestDialog.interestMode`: adicionar `'percentage_total'`
   - Tipo do `formData.overdue_penalty_type`: adicionar `'percentage_total'`
   - Dois blocos de formulario de criacao (daily e installment): adicionar `<SelectItem value="percentage_total">% do valor total</SelectItem>` e preview correspondente
   - Dialog de configuracao de juros por atraso: adicionar opcao no Select e atualizar preview
   - `openOverdueInterestDialog`: atualizar tipo para incluir `'percentage_total'`
   - Logica de materializacao de penalty (linha ~4285): adicionar calculo para `percentage_total`
   - `handleSaveOverdueInterest`: ja funciona pois usa `overdueInterestDialog.interestMode` dinamicamente

2. **`src/lib/calculations.ts`** (2 funcoes)
   - `getOverdueConfigFromNotes`: atualizar regex para aceitar `percentage_total`
   - `calculateDynamicOverdueInterest`: adicionar calculo para o novo tipo (valor total do contrato * taxa / 30 * dias)

3. **`supabase/functions/check-overdue-loans/index.ts`**
   - `getOverdueConfigFromNotes`: atualizar regex
   - Calculo de juros: adicionar branch para `percentage_total`

4. **`supabase/functions/check-overdue-contracts/index.ts`**
   - Mesmas alteracoes

5. **`supabase/functions/check-overdue-vehicles/index.ts`**
   - Mesmas alteracoes

### Logica de calculo

```text
percentage:       penaltyPerDay = installmentValue * (rate / 100)
fixed:            penaltyPerDay = fixedValue
percentage_total: penaltyPerDay = totalContractValue * (rate / 100) / 30
```

Onde `totalContractValue = principal_amount + total_interest`

### Preview no formulario

Para `percentage_total` com taxa 5% e valor total R$ 1.728,00:
```
"A cada dia de atraso, sera aplicado 5% do valor total / 30 dias"
"Previa: 5% de R$ 1.728,00 / 30 = R$ 2,88/dia"
```
