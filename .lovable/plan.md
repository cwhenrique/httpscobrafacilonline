
# Plano: Corrigir Data de Vencimento para Contratos Historicos

## Problema Identificado

Quando o usuario cria um emprestimo com data de inicio 15/01/2025 (mensal) e seleciona TODAS as parcelas historicas (incluindo 15/01/2026 que ja passou), o sistema esta definindo o vencimento como a data de HOJE (31/01/2026).

**Comportamento errado:**
- Data inicio: 15/01/2025
- Parcelas historicas incluem: 15/01/2025, 15/02/2025, ..., 15/01/2026 (13 parcelas)
- Usuario seleciona todas as 13 parcelas como juros recebidos
- Sistema define `due_date = "2026-01-31"` (hoje)

**Comportamento esperado:**
- Se a parcela de 15/01/2026 foi paga, a proxima parcela deveria ser 15/02/2026
- Sistema deveria definir `due_date = "2026-02-15"`

## Causa Raiz

Na linha 3666-3667 do `handleSubmit`:
```typescript
const todayStr = format(new Date(), 'yyyy-MM-dd');
const updatedDates = [todayStr]; // Usa a data de HOJE
```

O codigo usa a data de HOJE em vez de calcular a **proxima data do ciclo** baseada na frequencia.

## Solucao

### Logica Correta

1. Encontrar a ULTIMA parcela historica selecionada
2. Calcular a PROXIMA data apos essa parcela baseada na frequencia
3. Usar essa data como `due_date` e `installment_dates`

### Exemplo Pratico

| Data Inicio | Frequencia | Ultima Parcela Paga | Proxima Parcela |
|-------------|------------|---------------------|-----------------|
| 15/01/2025 | Mensal | 15/01/2026 | 15/02/2026 |
| 15/01/2025 | Semanal | 22/01/2026 | 29/01/2026 |
| 15/01/2025 | Quinzenal | 15/01/2026 | 29/01/2026 |

### Codigo Corrigido

```typescript
// Encontrar o maior indice selecionado (ultima parcela paga)
const maxSelectedIndex = Math.max(...selectedHistoricalInterestInstallments);

// Calcular a data da PROXIMA parcela (indice seguinte)
const nextInstallmentIndex = maxSelectedIndex + 1;
const nextDueDate = generateInstallmentDate(formData.start_date, nextInstallmentIndex, frequency);

const updatedDates = [nextDueDate];

await supabase.from('loans').update({
  notes: currentNotes.trim(),
  due_date: nextDueDate,
  installment_dates: updatedDates
}).eq('id', loanId);
```

## Arquivos Afetados

| Arquivo | Localizacao | Alteracao |
|---------|-------------|-----------|
| src/pages/Loans.tsx | handleSubmit (linhas 3666-3673) | Calcular proxima data do ciclo |
| src/pages/Loans.tsx | handleDailySubmit | Mesma correcao para emprestimos diarios |

## Fluxo Corrigido

### Antes (errado):
1. Inicio: 15/01/2025, mensal
2. Hoje: 31/01/2026
3. Parcelas historicas: 13 (15/01/25 ate 15/01/26)
4. Usuario seleciona todas
5. `due_date = "2026-01-31"` (ERRADO)

### Depois (correto):
1. Inicio: 15/01/2025, mensal
2. Hoje: 31/01/2026
3. Parcelas historicas: 13 (15/01/25 ate 15/01/26)
4. Usuario seleciona todas
5. Maior indice selecionado: 12 (parcela 15/01/2026)
6. Proxima parcela: indice 13 = 15/02/2026
7. `due_date = "2026-02-15"` (CORRETO)

## Testes Recomendados

1. Criar emprestimo mensal com inicio 15/01/2025, selecionar TODAS as parcelas
   - Esperado: vencimento = 15/02/2026

2. Criar emprestimo mensal com inicio 15/01/2025, selecionar apenas as 12 primeiras (ate 15/12/2025)
   - Esperado: vencimento = 15/01/2026

3. Criar emprestimo semanal com inicio 01/01/2026, selecionar todas as 4 parcelas
   - Esperado: vencimento = 05/02/2026 (7 dias apos 29/01/2026)
