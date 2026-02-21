

# Remover limite de 365 parcelas em emprestimos diarios

## Resumo
Atualmente, o campo de parcelas no formulario de emprestimo diario esta limitado a `max="365"`. Vou remover essa restricao para permitir um numero ilimitado de parcelas.

## O que sera alterado

### 1. Formulario de emprestimo diario (`src/pages/Loans.tsx`)
- Remover o atributo `max="365"` do input de "No de Parcelas" (linha 6662)
- Manter apenas `min="1"` para evitar valores negativos

### 2. Simulador de emprestimo (`src/components/LoanSimulator.tsx`)
- Alterar o retorno de `getMaxInstallments` para `daily`: de 365 para 9999 (ou remover o limite)

### 3. Limite de performance em contratos historicos (`src/pages/Loans.tsx`)
- Atualmente ha um `slice(0, 60)` que limita a exibicao de parcelas historicas passadas a 60. Isso precisara ser aumentado para acompanhar contratos maiores (ex: 500+ parcelas)

## Impacto no banco de dados

**Nenhum impacto estrutural.** O campo `installments` na tabela `loans` e do tipo `integer`, que suporta valores ate ~2 bilhoes. O campo `installment_dates` e `jsonb`, que suporta arrays grandes sem problema.

**Consideracoes de performance:**
- Emprestimos com muitas parcelas (ex: 1000+) geram um array JSON grande em `installment_dates`. Isso pode deixar queries um pouco mais lentas, mas nao deve ser um problema pratico ate ~5000 parcelas
- O calculo de datas no frontend (funcao `generateDailyDates`) roda no navegador e pode ficar lento acima de ~2000 parcelas, mas ainda funcional
- Os triggers de pagamento (`recalculate_loan_total_paid`, `update_loan_on_payment`) nao iteram sobre parcelas individualmente, entao nao sao afetados

## Secao tecnica

Arquivos modificados:
- `src/pages/Loans.tsx` - Remover `max="365"`, aumentar limite do slice de historico
- `src/components/LoanSimulator.tsx` - Remover limite de 365 no `getMaxInstallments`

Nenhuma migracao de banco de dados necessaria.
