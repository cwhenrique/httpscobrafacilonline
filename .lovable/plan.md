
# Validacao de Inconsistencia no Valor do Emprestimo

## Problema Identificado

Usuarios estao conseguindo criar emprestimos onde o valor emprestado (capital) e maior do que o valor total a receber. Isso ocorre quando a taxa de juros e negativa ou configurada incorretamente, causando calculos errados de lucro e inconsistencias nos relatorios financeiros (como ocorreu com o cliente "mariany faria" onde juros de -88% resultaram em prejuizo em vez de lucro).

## Solucao Proposta

Adicionar validacao em todos os pontos de criacao de emprestimo que detecta quando o valor emprestado (principal) e maior que o valor total a receber. Quando detectada, exibir um AlertDialog de aviso com checkbox de confirmacao. O usuario so pode prosseguir se marcar que entende a inconsistencia.

## Logica da Validacao

```text
SE principal_amount > total_a_receber ENTAO
  Exibir AlertDialog com aviso de inconsistencia
  Usuario deve marcar checkbox "Entendo que estou emprestando mais do que vou receber"
  Somente entao permitir criacao do emprestimo
SENAO
  Prosseguir normalmente
```

## Pontos de Alteracao

### 1. Novo Estado para Controle do AlertDialog

Adicionar em `src/pages/Loans.tsx`:
- Estado `inconsistencyWarningOpen: boolean` - controla visibilidade do dialog
- Estado `inconsistencyAcknowledged: boolean` - se usuario marcou checkbox
- Estado `pendingLoanData: object | null` - dados do emprestimo aguardando confirmacao
- Tipo para identificar qual formulario: `pendingLoanType: 'regular' | 'daily' | 'price'`

### 2. Funcao de Validacao Centralizada

Criar funcao `checkLoanInconsistency(principal, totalToReceive)`:
- Retorna `true` se principal > totalToReceive
- Usada em todos os handlers de submit

### 3. Modificar handleSubmit (Emprestimo Regular)

Local: linhas ~3000-3100

Antes de chamar `createLoan()`:
1. Calcular `totalToReceive = principal + totalInterest`
2. Se `principal > totalToReceive`, salvar dados em `pendingLoanData` e abrir AlertDialog
3. Se nao, prosseguir normalmente

### 4. Modificar handleDailySubmit (Emprestimo Diario)

Local: linhas ~2560-2665

Antes de chamar `createLoan()`:
1. Calcular `totalToReceive = dailyAmount * numDays`
2. Se `principalAmount > totalToReceive`, salvar dados e abrir AlertDialog
3. Se nao, prosseguir normalmente

### 5. Modificar handlePriceTableSubmit (Tabela Price Inline)

Local: linhas ~573-607

Antes de chamar `createLoan()`:
1. Usar `priceTablePreview.totalPayment` como totalToReceive
2. Se `principal > totalPayment`, salvar dados e abrir AlertDialog
3. Se nao, prosseguir normalmente

### 6. Modificar PriceTableDialog (Componente)

Local: `src/components/PriceTableDialog.tsx` linhas ~107-160

Adicionar:
- Estados locais para controle do AlertDialog
- Checkbox de confirmacao
- Validacao antes de chamar `onCreateLoan()`

### 7. Novo AlertDialog de Aviso

Adicionar componente AlertDialog em `src/pages/Loans.tsx`:

```
Titulo: "Atencao: Inconsistencia Detectada"
Icone: AlertTriangle (amarelo)

Mensagem:
"O valor emprestado (R$ X) e MAIOR do que o valor total a receber (R$ Y).

Isso significa que voce vai receber MENOS do que emprestou, resultando em PREJUIZO.

Verifique se a taxa de juros e o numero de parcelas estao corretos."

Checkbox: "Entendo que estou emprestando mais do que vou receber e desejo continuar"

Botoes:
- "Cancelar" - fecha dialog e volta ao formulario
- "Continuar Mesmo Assim" - so habilitado se checkbox marcado, cria emprestimo
```

## Fluxo de Usuario

```text
1. Usuario preenche formulario de emprestimo
2. Usuario clica em "Criar Emprestimo"
3. Sistema calcula total a receber
4. SE valor emprestado > total a receber:
   a. Abre AlertDialog com aviso
   b. Usuario le a mensagem
   c. Usuario marca checkbox de confirmacao
   d. Usuario clica "Continuar Mesmo Assim"
   e. Emprestimo e criado
5. SE valores estao corretos:
   a. Emprestimo e criado normalmente
```

## Secao Tecnica

### Arquivos a Modificar

1. **src/pages/Loans.tsx**
   - Adicionar imports: `AlertTriangle` de lucide-react
   - Novos estados (~linha 493):
     ```typescript
     const [inconsistencyWarningOpen, setInconsistencyWarningOpen] = useState(false);
     const [inconsistencyAcknowledged, setInconsistencyAcknowledged] = useState(false);
     const [pendingLoanData, setPendingLoanData] = useState<any>(null);
     const [pendingLoanType, setPendingLoanType] = useState<'regular' | 'daily' | 'price' | null>(null);
     ```
   - Funcao de validacao:
     ```typescript
     const checkLoanInconsistency = (principal: number, totalToReceive: number): boolean => {
       return principal > totalToReceive && totalToReceive > 0;
     };
     ```
   - Funcao para processar emprestimo apos confirmacao:
     ```typescript
     const handleConfirmedLoanCreation = async () => {
       // Processa pendingLoanData baseado em pendingLoanType
     };
     ```
   - AlertDialog JSX no final do componente
   - Modificar handleSubmit, handleDailySubmit, handlePriceTableSubmit

2. **src/components/PriceTableDialog.tsx**
   - Adicionar estados locais para validacao
   - Adicionar AlertDialog no JSX
   - Modificar handleSubmit

### Exemplo de Estrutura do AlertDialog

```typescript
<AlertDialog open={inconsistencyWarningOpen} onOpenChange={setInconsistencyWarningOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
        <AlertTriangle className="w-5 h-5" />
        Atencao: Inconsistencia Detectada
      </AlertDialogTitle>
      <AlertDialogDescription className="space-y-3">
        <p>
          O valor emprestado (<strong>{formatCurrency(pendingLoanData?.principal)}</strong>) e 
          <strong className="text-red-600"> MAIOR </strong> 
          do que o valor total a receber (<strong>{formatCurrency(pendingLoanData?.totalToReceive)}</strong>).
        </p>
        <p className="text-red-600 font-medium">
          Isso significa que voce vai receber MENOS do que emprestou, resultando em PREJUIZO.
        </p>
        <p>
          Verifique se a taxa de juros e o numero de parcelas estao corretos.
        </p>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="flex items-start space-x-2 py-4">
      <Checkbox 
        id="acknowledge" 
        checked={inconsistencyAcknowledged}
        onCheckedChange={(checked) => setInconsistencyAcknowledged(!!checked)}
      />
      <Label htmlFor="acknowledge" className="text-sm cursor-pointer">
        Entendo que estou emprestando mais do que vou receber e desejo continuar
      </Label>
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => {
        setInconsistencyWarningOpen(false);
        setInconsistencyAcknowledged(false);
        setPendingLoanData(null);
      }}>
        Cancelar
      </AlertDialogCancel>
      <AlertDialogAction
        disabled={!inconsistencyAcknowledged}
        onClick={handleConfirmedLoanCreation}
        className="bg-amber-600 hover:bg-amber-700"
      >
        Continuar Mesmo Assim
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Validacao no handleDailySubmit (exemplo)

```typescript
// Antes de createLoan
const totalToReceive = dailyAmount * numDays;
if (checkLoanInconsistency(principalAmount, totalToReceive)) {
  setPendingLoanData({
    principal: principalAmount,
    totalToReceive: totalToReceive,
    loanData: loanData, // dados completos para criar
  });
  setPendingLoanType('daily');
  setInconsistencyWarningOpen(true);
  return; // Nao continua - aguarda confirmacao
}
// Se passou, continua normalmente
const result = await createLoan(loanData);
```

## Beneficios

1. Previne erros de configuracao que resultam em prejuizo
2. Usuario e informado claramente sobre a inconsistencia
3. Nao bloqueia completamente - usuario pode continuar se confirmar
4. Protege integridade dos relatorios financeiros
5. Evita casos como o de "mariany faria" com lucro negativo
