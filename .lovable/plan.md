
## Nova Modalidade de Juros: Parcelas Personalizadas (custom)

### Resumo

Adicionar uma nova modalidade de juros chamada **"Parcelas Personalizadas"** (`custom`) que permite ao usuario definir valores individuais para cada parcela ao criar um emprestimo mensal, semanal ou quinzenal. Exemplo: Parcela 1 = R$ 300, Parcela 2 = R$ 200, Parcela 3 = R$ 400.

### Alteracoes Necessarias

#### 1. Banco de Dados - Adicionar novo valor ao enum `interest_mode`

Criar uma migracao SQL para adicionar `'custom'` ao enum `interest_mode`:

```sql
ALTER TYPE interest_mode ADD VALUE 'custom';
```

Isso permite que o campo `interest_mode` aceite o valor `'custom'` nos emprestimos.

#### 2. Tipo TypeScript - `src/types/database.ts`

Atualizar o tipo `InterestMode` para incluir `'custom'`:

```typescript
export type InterestMode = 'per_installment' | 'on_total' | 'compound' | 'sac' | 'custom';
```

#### 3. Formulario de Criacao - `src/pages/Loans.tsx`

**3a. Adicionar opcao no Select de "Juros Aplicado"** (~linha 7309):
- Novo `SelectItem` com valor `"custom"` e label "Parcelas Personalizadas"

**3b. Estado do formulario** (~linha 2215):
- Atualizar o tipo do `interest_mode` para incluir `'custom'`
- Adicionar estado `customInstallmentValues: string[]` para guardar os valores individuais de cada parcela

**3c. UI condicional para parcelas personalizadas**:
- Quando `interest_mode === 'custom'`, esconder os campos "Taxa de Juros (%)" e "Valor da Parcela" fixos
- Exibir uma lista de inputs, um por parcela (baseado no numero de parcelas informado), onde o usuario digita o valor de cada uma
- Cada input mostrara "Parcela 1:", "Parcela 2:", etc.
- Exibir um resumo automatico: soma total, lucro (soma - principal)
- O campo "Juros Total" sera calculado automaticamente como soma das parcelas - principal

**3d. Logica de criacao do emprestimo** (~linha 3849):
- Quando `interest_mode === 'custom'`:
  - `total_interest` = soma dos valores das parcelas - principal
  - `remaining_balance` = soma dos valores das parcelas
  - `interest_rate` = 0 (nao se aplica)
  - Salvar os valores individuais nas notas com tag `[CUSTOM_INSTALLMENTS:300,200,400]` para referencia futura

#### 4. Exibicao e Pagamento - `src/pages/Loans.tsx`

**4a. Valor da parcela na listagem de vencimentos**:
- As funcoes helper (`getInstallmentValueForIndex`, `getExpectedInstallmentValue`, etc.) precisam verificar se o emprestimo tem a tag `[CUSTOM_INSTALLMENTS:...]` e retornar o valor correto para cada indice

**4b. Processamento de pagamento**:
- O `principal_paid` e `interest_paid` serao calculados proporcionalmente ao valor da parcela customizada

#### 5. Helpers de calculo - `src/lib/calculations.ts`

- Adicionar funcao `parseCustomInstallments(notes: string): number[] | null` para extrair valores da tag
- Atualizar `calculateTotalToReceive` para tratar `interest_mode === 'custom'` usando a soma dos valores customizados
- Atualizar funcoes que calculam valor de parcela por indice para verificar se ha valores customizados

#### 6. Hook `useLoans.ts`

- Atualizar tipos do `createLoan` e `editLoan` para aceitar `'custom'` no `interest_mode`

#### 7. Outros arquivos impactados

- **`src/hooks/useOperationalStats.ts`**: Tratar `custom` nos calculos de estatisticas
- **`src/pages/ReportsLoans.tsx`**: Tratar `custom` nos relatorios
- **`src/pages/CalendarView.tsx`**: Tratar `custom` na visualizacao de calendario
- **`src/lib/pdfGenerator.ts`**: Exibir "Parcelas Personalizadas" como modo de juros no PDF
- **Formulario de edicao** (~linha 14304): Adicionar opcao `custom` no Select de edicao

### Fluxo do Usuario

1. Usuario seleciona modalidade "Parcelas Personalizadas" no campo "Juros Aplicado"
2. Os campos de taxa de juros sao escondidos
3. Usuario informa o numero de parcelas (ex: 3)
4. Aparece uma lista com 3 campos de valor
5. Usuario preenche: Parcela 1 = R$ 300, Parcela 2 = R$ 200, Parcela 3 = R$ 400
6. Sistema calcula automaticamente: Total = R$ 900, Lucro = R$ 900 - Principal
7. Usuario confirma e o emprestimo e criado com os valores individuais

### Armazenamento

Os valores customizados serao armazenados na coluna `notes` do emprestimo usando a tag:
```
[CUSTOM_INSTALLMENTS:300.00,200.00,400.00]
```

Isso evita alteracoes na estrutura da tabela `loans` e permite retrocompatibilidade.
