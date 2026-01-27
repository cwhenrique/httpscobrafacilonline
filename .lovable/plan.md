
# Validacao Visual em Tempo Real para Emprestimos Diarios Inconsistentes

## Problema Identificado

O formulario de emprestimo diario permite criar configuracoes com valores inconsistentes (valor emprestado > total a receber) e mostra o resumo com lucro negativo sem nenhum destaque visual de alerta. O usuario so ve o aviso quando clica em "Criar Emprestimo".

Exemplo do problema (conforme screenshot):
- Valor Emprestado: R$ 20.000
- Parcela Diaria: R$ 20
- Juros: -98,50% (negativo!)
- Total a receber: R$ 300
- Lucro: -R$ 19.700,00

O resumo aparece em azul (cor normal) em vez de vermelho (cor de alerta).

## Solucao Proposta

Adicionar feedback visual em tempo real no formulario de emprestimo diario:

1. **Mudar cor do resumo** quando ha inconsistencia (de azul para vermelho/amarelo)
2. **Adicionar icone de alerta** no resumo quando lucro e negativo
3. **Destacar visualmente o campo de juros** quando negativo
4. **Mostrar mensagem de aviso clara** no resumo

## Alteracoes Necessarias

### 1. Modificar o Card de Resumo no Formulario Diario

Localizado em `src/pages/Loans.tsx` linhas ~5519-5530

**Logica de deteccao:**
```text
principal = parseFloat(formData.principal_amount)
totalToReceive = parseFloat(formData.daily_amount) * installmentDates.length
hasInconsistency = principal > totalToReceive && totalToReceive > 0
profit = totalToReceive - principal
```

**Mudancas visuais quando hasInconsistency = true:**
- Background: de `bg-sky-50 dark:bg-sky-900/30` para `bg-red-50 dark:bg-red-900/30`
- Border: de `border-sky-200 dark:border-sky-700` para `border-red-300 dark:border-red-700`
- Texto: de `text-sky-*` para `text-red-*`
- Adicionar icone `AlertTriangle` ao lado do titulo "Resumo"
- Adicionar texto de aviso: "ATENCAO: Voce vai receber MENOS do que emprestou!"

### 2. Destacar Campo de Juros Negativo

Localizado em `src/pages/Loans.tsx` linhas ~5507-5518

**Mudancas quando juros < 0:**
- Adicionar classe `border-red-500` ao Input
- Mudar cor do Label para vermelho
- Adicionar texto de aviso abaixo: "Taxa negativa resultara em prejuizo"

### 3. Mesma Logica para Modal de Edicao

O mesmo card de resumo existe no modal de edicao (linhas ~12485+). Aplicar as mesmas mudancas.

## Implementacao Tecnica

### Arquivo: src/pages/Loans.tsx

#### Calcular estado de inconsistencia (adicionar variaveis derivadas antes do JSX)

Adicionar apos linha ~1870 (junto com hasPastDates):

```typescript
// Detectar inconsistencia no formulario diario
const dailyFormInconsistency = useMemo(() => {
  const principal = parseFloat(formData.principal_amount) || 0;
  const dailyAmount = parseFloat(formData.daily_amount) || 0;
  const numInstallments = installmentDates.length;
  const totalToReceive = dailyAmount * numInstallments;
  const profit = totalToReceive - principal;
  const interestRate = parseFloat(formData.daily_interest_rate) || 0;
  
  const hasInconsistency = principal > 0 && totalToReceive > 0 && principal > totalToReceive;
  const hasNegativeInterest = interestRate < 0;
  
  return {
    hasInconsistency,
    hasNegativeInterest,
    principal,
    totalToReceive,
    profit,
  };
}, [formData.principal_amount, formData.daily_amount, formData.daily_interest_rate, installmentDates.length]);
```

#### Modificar Card de Resumo (~linhas 5519-5530)

**De:**
```jsx
<div className="bg-sky-50 dark:bg-sky-900/30 rounded-lg p-2 sm:p-3 space-y-0.5 sm:space-y-1 border border-sky-200 dark:border-sky-700">
  <p className="text-xs sm:text-sm font-medium text-sky-900 dark:text-sky-100">Resumo ({installmentDates.length} parcelas):</p>
  ...
</div>
```

**Para:**
```jsx
<div className={cn(
  "rounded-lg p-2 sm:p-3 space-y-0.5 sm:space-y-1 border",
  dailyFormInconsistency.hasInconsistency 
    ? "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700" 
    : "bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700"
)}>
  <p className={cn(
    "text-xs sm:text-sm font-medium flex items-center gap-1",
    dailyFormInconsistency.hasInconsistency 
      ? "text-red-900 dark:text-red-100" 
      : "text-sky-900 dark:text-sky-100"
  )}>
    {dailyFormInconsistency.hasInconsistency && <AlertTriangle className="w-4 h-4" />}
    Resumo ({installmentDates.length} parcelas):
  </p>
  <p className={cn(
    "text-xs sm:text-sm",
    dailyFormInconsistency.hasInconsistency 
      ? "text-red-700 dark:text-red-200" 
      : "text-sky-700 dark:text-sky-200"
  )}>
    Total a receber: {formatCurrency(dailyFormInconsistency.totalToReceive)}
  </p>
  <p className={cn(
    "text-xs sm:text-sm",
    dailyFormInconsistency.hasInconsistency 
      ? "text-red-700 dark:text-red-200 font-semibold" 
      : "text-sky-700 dark:text-sky-200"
  )}>
    Lucro: {formatCurrency(dailyFormInconsistency.profit)} 
    ({((dailyFormInconsistency.profit / dailyFormInconsistency.principal) * 100).toFixed(1)}%)
  </p>
  {dailyFormInconsistency.hasInconsistency && (
    <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-semibold mt-1">
      ATENCAO: Voce vai receber MENOS do que emprestou!
    </p>
  )}
</div>
```

#### Modificar Input de Juros (~linhas 5507-5518)

**De:**
```jsx
<div className="space-y-1 sm:space-y-2">
  <Label className="text-xs sm:text-sm">Juros (%)</Label>
  <Input 
    type="number" 
    step="0.01" 
    value={formData.daily_interest_rate} 
    onChange={(e) => handleDailyInterestChange(e.target.value)} 
    placeholder="Ex: 25"
    className="h-9 sm:h-10 text-sm"
  />
  <p className="text-[10px] text-muted-foreground">Altere o juros para recalcular a parcela automaticamente</p>
</div>
```

**Para:**
```jsx
<div className="space-y-1 sm:space-y-2">
  <Label className={cn(
    "text-xs sm:text-sm",
    dailyFormInconsistency.hasNegativeInterest && "text-red-600 dark:text-red-400"
  )}>
    Juros (%)
    {dailyFormInconsistency.hasNegativeInterest && (
      <span className="text-red-600 dark:text-red-400 ml-1">- Taxa Negativa!</span>
    )}
  </Label>
  <Input 
    type="number" 
    step="0.01" 
    value={formData.daily_interest_rate} 
    onChange={(e) => handleDailyInterestChange(e.target.value)} 
    placeholder="Ex: 25"
    className={cn(
      "h-9 sm:h-10 text-sm",
      dailyFormInconsistency.hasNegativeInterest && "border-red-500 focus:ring-red-500"
    )}
  />
  <p className={cn(
    "text-[10px]",
    dailyFormInconsistency.hasNegativeInterest 
      ? "text-red-600 dark:text-red-400" 
      : "text-muted-foreground"
  )}>
    {dailyFormInconsistency.hasNegativeInterest 
      ? "Taxa negativa resultara em prejuizo!" 
      : "Altere o juros para recalcular a parcela automaticamente"}
  </p>
</div>
```

### Aplicar Mesmas Mudancas no Modal de Edicao

Localizar o card de resumo equivalente no modal de edicao (linhas ~12470+) e aplicar a mesma logica visual.

## Fluxo de Usuario Apos Implementacao

1. Usuario preenche Valor Emprestado: R$ 20.000
2. Usuario preenche Parcela Diaria: R$ 20
3. **IMEDIATAMENTE** o campo Juros mostra "-98.50%" em vermelho
4. **IMEDIATAMENTE** o card de resumo muda de azul para vermelho
5. Icone de alerta aparece no titulo do resumo
6. Mensagem "ATENCAO: Voce vai receber MENOS do que emprestou!" aparece
7. Usuario ve claramente o problema ANTES de tentar criar o emprestimo
8. Se usuario ainda tentar criar, AlertDialog de confirmacao aparece (ja implementado)

## Beneficios

1. Feedback visual instantaneo - usuario ve o problema imediatamente
2. Cores de alerta chamam atencao para o erro
3. Mensagem clara explica o problema
4. Mantém a possibilidade de criar se usuario confirmar (nao bloqueia)
5. Previne erros como o caso "mariany faria" que causou lucro negativo nos relatorios
