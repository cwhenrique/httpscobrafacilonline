

# Plano: Registros Historicos com Pagamentos de Juros Automaticos

## Entendendo o Cenario

**Exemplo do usuario:**
- Emprestimo de R$ 1.000 a 10% ao mes
- Data inicio: 10/01/2025
- Data atual: 10/01/2026 (1 ano depois)
- Resultado esperado: 12 parcelas de juros de R$ 100 cada

**Comportamento desejado:**
1. Sistema detecta que ha 12 meses passados
2. Mostra TODAS as 12 parcelas de juros (R$ 100 cada)
3. Ao criar o emprestimo:
   - Total a Receber: R$ 1.100 (principal + 1 mes de juros)
   - Lucro Realizado: R$ 1.200 (12 x R$ 100 ja recebidos como juros)
   - Pago: R$ 1.200 (valor total ja recebido)
   - Restante a Receber: R$ 1.100 (valor cheio - principal nao foi tocado)

**Diferenca do sistema atual:**
- Hoje: Usuario marca parcelas como "pagas" (principal + juros) e digita juros antigos manualmente
- Novo: Sistema gera automaticamente pagamentos de "somente juros" para cada mes passado

## Arquitetura da Solucao

### Nova Interface de Registros Historicos

Substituir a caixa amarela atual por uma nova interface roxa mais completa:

```text
+------------------------------------------------------------------+
|  REGISTROS HISTORICOS DE JUROS                                   |
|  Este contrato possui 12 parcelas anteriores a data atual        |
+------------------------------------------------------------------+
|                                                                   |
|  [ ] Selecionar Todas   [ ] Nenhuma                              |
|                                                                   |
|  +--------------------------------------------------------------+|
|  | [x] Parcela 1 - 10/01/2025 - Juros: R$ 100,00               ||
|  | [x] Parcela 2 - 10/02/2025 - Juros: R$ 100,00               ||
|  | [x] Parcela 3 - 10/03/2025 - Juros: R$ 100,00               ||
|  | ...                                                          ||
|  | [x] Parcela 12 - 10/12/2025 - Juros: R$ 100,00              ||
|  +--------------------------------------------------------------+|
|                                                                   |
|  Total de Juros Historicos: R$ 1.200,00                          |
+------------------------------------------------------------------+
```

### Logica de Calculo

Para cada parcela passada marcada como "juros recebidos":
- Registrar um pagamento de `[INTEREST_ONLY_PAYMENT]` 
- `amount`: valor do juros da parcela
- `principal_paid`: 0 (nao reduz principal)
- `interest_paid`: valor do juros
- Adicionar tag `[HISTORICAL_INTEREST_ONLY_PAID:indice:valor:data]`

### Valores Resultantes

| Campo | Calculo | Exemplo |
|-------|---------|---------|
| Principal | Valor emprestado | R$ 1.000 |
| Total Interest | Juros de 1 periodo (proximo) | R$ 100 |
| Remaining Balance | Principal + 1 periodo de juros | R$ 1.100 |
| Total Paid | Soma de todos pagamentos de juros | R$ 1.200 |
| Lucro Realizado | Soma de interest_paid | R$ 1.200 |

## Alteracoes Necessarias

### 1. Estado do Formulario

**Arquivo:** `src/pages/Loans.tsx`

Adicionar novo estado para rastrear parcelas de juros historicos selecionadas:

```typescript
// Estado para parcelas de juros historicos selecionadas
const [selectedHistoricalInterestInstallments, setSelectedHistoricalInterestInstallments] = useState<number[]>([]);
```

### 2. Calcular Juros por Parcela (useMemo)

Criar/atualizar `pastInstallmentsData` para calcular juros por parcela:

```typescript
const historicalInterestData = useMemo(() => {
  // Calcular juros por parcela baseado no tipo de emprestimo
  // Para mensal: juros = principal * taxa
  // Para diario: juros = (valor_parcela - principal_por_parcela)
  
  return {
    installments: [
      { index: 0, date: '2025-01-10', interestAmount: 100 },
      { index: 1, date: '2025-02-10', interestAmount: 100 },
      // ...
    ],
    totalHistoricalInterest: 1200,
    interestPerInstallment: 100,
  };
}, [formData, installmentDates]);
```

### 3. Nova UI de Registros Historicos

Substituir a secao atual de "Parcelas passadas" por nova interface:

```tsx
{formData.is_historical_contract && historicalInterestData.installments.length > 0 && (
  <div className="p-4 rounded-lg bg-purple-500/20 border border-purple-400/30 space-y-3">
    <div className="flex justify-between items-center">
      <Label className="text-sm text-purple-200 flex items-center gap-2">
        <History className="h-4 w-4" />
        Registros Historicos de Juros
      </Label>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" 
          onClick={() => setSelectedHistoricalInterestInstallments(
            historicalInterestData.installments.map(i => i.index)
          )}>
          Todas
        </Button>
        <Button type="button" variant="ghost" size="sm"
          onClick={() => setSelectedHistoricalInterestInstallments([])}>
          Nenhuma
        </Button>
      </div>
    </div>
    
    <ScrollArea className="h-48">
      {historicalInterestData.installments.map((installment) => (
        <label key={installment.index} className="flex items-center gap-2 p-2">
          <Checkbox
            checked={selectedHistoricalInterestInstallments.includes(installment.index)}
            onCheckedChange={(checked) => {
              // toggle selection
            }}
          />
          <span>Parcela {installment.index + 1} - {formatDate(installment.date)}</span>
          <span className="ml-auto text-purple-300">
            Juros: {formatCurrency(installment.interestAmount)}
          </span>
        </label>
      ))}
    </ScrollArea>
    
    <div className="p-3 rounded bg-purple-500/10 border border-purple-400/20">
      <p className="text-sm text-purple-200 font-medium">
        Total de Juros Historicos: {formatCurrency(
          selectedHistoricalInterestInstallments.length * historicalInterestData.interestPerInstallment
        )}
      </p>
      <p className="text-xs text-purple-300/70 mt-1">
        Estes valores serao registrados como juros ja recebidos (principal nao sera alterado)
      </p>
    </div>
  </div>
)}
```

### 4. Logica de Criacao (handleSubmit / handleDailySubmit)

Apos criar o emprestimo, registrar pagamentos de juros historicos:

```typescript
// Registrar pagamentos de juros historicos
if (formData.is_historical_contract && selectedHistoricalInterestInstallments.length > 0) {
  const loanId = result.data.id;
  const interestPerInstallment = historicalInterestData.interestPerInstallment;
  
  for (const idx of selectedHistoricalInterestInstallments) {
    const installment = historicalInterestData.installments.find(i => i.index === idx);
    if (!installment) continue;
    
    await registerPayment({
      loan_id: loanId,
      amount: installment.interestAmount,
      principal_paid: 0,  // NAO reduz principal
      interest_paid: installment.interestAmount,  // Apenas juros
      payment_date: installment.date,
      notes: `[INTEREST_ONLY_PAYMENT] [HISTORICAL_INTEREST_ONLY_PAID:${idx}:${installment.interestAmount}:${installment.date}] Juros parcela ${idx + 1}`,
    });
  }
  
  // Adicionar tag ao emprestimo
  const totalHistoricalInterest = selectedHistoricalInterestInstallments.length * interestPerInstallment;
  await supabase.from('loans').update({
    notes: currentNotes + ` [HISTORICAL_INTEREST_CONTRACT] [TOTAL_HISTORICAL_INTEREST_RECEIVED:${totalHistoricalInterest}]`
  }).eq('id', loanId);
}
```

### 5. Manter Sistema Antigo como Fallback

A opcao de digitar manualmente o valor de juros antigos ainda existira, mas como campo secundario para casos onde o usuario nao quer detalhar parcela por parcela.

### 6. Exibicao nos Cards

Quando um emprestimo tiver juros historicos:
- Mostrar badge roxo "Juros Historicos"
- Na area expandida, mostrar lista de juros recebidos por data

## Fluxo de Uso

### Cenario: Usuario cadastra emprestimo de 1 ano atras

1. Usuario abre formulario de novo emprestimo
2. Seleciona cliente e digita R$ 1.000 a 10% ao mes
3. Define data inicio: 10/01/2025 (1 ano atras)
4. Sistema detecta 12 parcelas no passado
5. Checkbox "Este e um contrato antigo" aparece
6. Usuario marca o checkbox
7. Lista de 12 parcelas de juros aparece (R$ 100 cada)
8. Usuario clica "Selecionar Todas"
9. Resumo mostra: "Total Juros Historicos: R$ 1.200"
10. Usuario clica "Criar Emprestimo"

### Resultado no Sistema:

```
Emprestimo Criado:
- Principal: R$ 1.000
- Juros do Periodo: R$ 100
- Total a Receber: R$ 1.100
- Status: Pendente

Pagamentos Registrados (automaticamente):
- 10/01/2025: R$ 100 (juros parcela 1) [INTEREST_ONLY]
- 10/02/2025: R$ 100 (juros parcela 2) [INTEREST_ONLY]
- ... (12 registros)

Metricas Resultantes:
- Pago: R$ 1.200
- Lucro Realizado: R$ 1.200
- Restante: R$ 1.100
```

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Loans.tsx` | Novo estado, novo useMemo para calculo, nova UI de selecao, logica de criacao |

## Consideracoes Tecnicas

1. **Performance**: Limitar lista a 60 parcelas (5 anos de emprestimo mensal)
2. **Tags**: Usar `[INTEREST_ONLY_PAYMENT]` para que o trigger do banco nao reduza o principal
3. **Compatibilidade**: Manter campo de "juros antigos manual" para usuarios que preferem o metodo antigo
4. **Anti-duplicacao**: Usar a mesma logica de skip para pagamentos historicos que ja existe

## Estimativa

- **Complexidade**: Media
- **Linhas de codigo**: ~200-300
- **Risco**: Baixo (adiciona funcionalidade sem quebrar existente)
- **Testes recomendados**:
  - Criar emprestimo com 12 meses passados, selecionar todas as parcelas de juros
  - Verificar que "Lucro Realizado" mostra soma correta
  - Verificar que "Restante a Receber" mostra principal + 1 periodo de juros
  - Verificar que principal nao foi reduzido (remaining_balance correto)

