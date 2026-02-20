
## Adicionar Sistema de Amortizacao SAC (Sistema de Amortizacao Constante)

### O que e o SAC?
No SAC, a amortizacao do principal e constante em todas as parcelas. Os juros sao calculados sobre o saldo devedor, que diminui a cada parcela. Resultado: parcelas decrescentes (a primeira e a maior, a ultima e a menor).

### Formula SAC
- Amortizacao = Principal / N (constante)
- Juros da parcela k = Saldo devedor x Taxa mensal
- Saldo devedor apos parcela k = Principal - (k x Amortizacao)
- Parcela k = Amortizacao + Juros da parcela k

### Alteracoes Necessarias

**1. Banco de Dados - Adicionar valor 'sac' ao enum `interest_mode`**

Migracao SQL:
```sql
ALTER TYPE interest_mode ADD VALUE 'sac';
```

Isso permite salvar `interest_mode = 'sac'` nos emprestimos.

**2. `src/lib/calculations.ts` - Adicionar funcoes SAC**

- Nova funcao `generateSACTable(principal, monthlyRate, installments)` que retorna:
  - Array de linhas com: numero da parcela, amortizacao (constante), juros (decrescente), valor da parcela (decrescente), saldo devedor
  - Total de juros e total a pagar
- Nova funcao `calculateSACInterest(principal, monthlyRate, installments)` que retorna o total de juros no SAC

**3. `src/types/database.ts` - Atualizar tipo InterestMode**

Adicionar `'sac'` ao tipo:
```typescript
export type InterestMode = 'per_installment' | 'on_total' | 'compound' | 'sac';
```

**4. `src/pages/Loans.tsx` - Multiplas alteracoes**

- **Formulario de criacao (linha ~7182)**: Adicionar opcao `<SelectItem value="sac">SAC</SelectItem>` no dropdown "Juros Aplicado"
- **Formulario de edicao (linha ~14126)**: Adicionar mesma opcao no dropdown de edicao
- **Calculo na criacao (linha ~3776)**: Adicionar `else if (formData.interest_mode === 'sac')` com calculo SAC
- **Calculo na edicao**: Adicionar mesma logica no recalculo
- **Display do modo (linha ~10055)**: Adicionar label "SAC" quando `interest_mode === 'sac'`
- **Tipo do formData (linha ~1116)**: Incluir `'sac'` no union type
- **Todas as funcoes helper** (getPaidIndicesFromNotes, getPaidInstallmentsCount, etc.): Adicionar tratamento para `'sac'`
- **remaining_balance na criacao**: Usar total SAC (principal + total juros SAC)
- **Parcelas individuais**: Como SAC tem parcelas decrescentes, ao exibir valor de cada parcela na tabela de parcelas, calcular individualmente usando a formula SAC em vez de dividir igualmente

**5. `src/components/LoanSimulator.tsx` - Adicionar modo SAC**

- Adicionar `'sac'` ao tipo InterestMode local
- Adicionar label `sac: 'SAC (Amort. Constante)'` nos labels
- Adicionar caso `'sac'` na funcao `calculateInterest`
- Gerar schedule com parcelas decrescentes no SAC (amortizacao constante, juros sobre saldo)
- Adicionar na tabela de comparacao
- Adicionar estilo visual (cor verde para diferenciar)

**6. `src/components/PriceTableDialog.tsx` - Referencia**

Manter como esta - a Tabela Price ja tem seu dialog separado. O SAC usara o fluxo normal de criacao com `interest_mode = 'sac'`.

**7. Funcoes de cobranca/notificacao**

- `src/components/SendOverdueNotification.tsx`: Tratar `interest_mode === 'sac'` nos calculos de valor de parcela (parcelas nao sao iguais no SAC)
- `src/lib/messageUtils.ts`: Calculos de opcoes de pagamento para SAC

**8. Relatorios e outras paginas**

- `src/pages/CalendarView.tsx`: Adicionar tratamento SAC no calculo de juros
- `src/pages/ReportsLoans.tsx` e outras paginas que calculam juros: Adicionar caso SAC

### Diferencial do SAC vs Price vs outros modos

| Modo | Parcela | Amortizacao | Juros |
|------|---------|-------------|-------|
| Por Parcela | Constante | Constante | Constante |
| Sobre o Total | Constante | Constante | Constante |
| Compostos Puros | Constante | Constante | Constante |
| Tabela Price | Constante | Crescente | Decrescente |
| **SAC** | **Decrescente** | **Constante** | **Decrescente** |

### Detalhes Tecnicos

A principal complexidade do SAC e que cada parcela tem um valor diferente. O sistema atual assume parcelas iguais em varios lugares. Precisaremos:

1. Armazenar o `total_interest` correto (soma de todos os juros SAC)
2. Ao exibir valor individual de cada parcela, recalcular com base no indice usando: `parcela[i] = (principal/n) + ((principal - i*(principal/n)) * taxa/100)`
3. No pagamento, calcular o valor esperado da parcela especifica
4. No remaining_balance, a logica existente de subtrair pagamentos ja funciona

A tag `[SAC_TABLE]` sera adicionada nas notas do emprestimo para identificacao rapida.
