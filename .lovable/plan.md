
# Plano: Restaurar Botão "Adicionar Multa" para Qualquer Parcela

## Resumo

Vou adicionar um botão "Adicionar Multa" na barra de ações do empréstimo que permitirá adicionar uma multa a qualquer parcela, independentemente de o empréstimo estar em atraso ou não.

## Situação Atual

- O botão "Aplicar Multa" só aparece dentro do bloco de empréstimos em atraso (`isOverdue`)
- Não há como adicionar multa a parcelas que ainda não venceram
- O diálogo existente (`manualPenaltyDialog`) foi desenhado para trabalhar apenas com parcelas em atraso

## Solução

Criar um novo botão na barra de ações (junto com Pagar, Pagar Juros, Histórico, etc.) que abre um diálogo simplificado permitindo:
1. Selecionar qual parcela receber a multa
2. Inserir o valor da multa
3. Salvar (adiciona tag `[DAILY_PENALTY:índice:valor]` no campo notes)

## Alterações

### 1. Novo State para o Diálogo

Adicionar um novo state para controlar o diálogo de multa avulsa (após linha ~1047):

```typescript
// Dialog para adicionar multa em qualquer parcela
const [addPenaltyDialog, setAddPenaltyDialog] = useState<{
  isOpen: boolean;
  loanId: string;
  currentNotes: string | null;
  installments: Array<{
    index: number;
    dueDate: string;
    installmentValue: number;
    isPaid: boolean;
    existingPenalty: number;
  }>;
} | null>(null);
const [selectedPenaltyInstallment, setSelectedPenaltyInstallment] = useState<number | null>(null);
const [penaltyAmount, setPenaltyAmount] = useState('');
```

### 2. Função para Abrir o Diálogo

Adicionar função para preparar e abrir o diálogo:

```typescript
const openAddPenaltyDialog = (loan: any, installmentValue: number) => {
  const dates = (loan.installment_dates as string[]) || [];
  const paidCount = getPaidInstallmentsCount(loan);
  const existingPenalties = getDailyPenaltiesFromNotes(loan.notes);
  
  const installments = dates.map((date, index) => ({
    index,
    dueDate: date,
    installmentValue,
    isPaid: index < paidCount,
    existingPenalty: existingPenalties[index] || 0
  }));
  
  // Se não houver datas, criar pelo menos uma parcela
  if (installments.length === 0) {
    installments.push({
      index: 0,
      dueDate: loan.due_date,
      installmentValue,
      isPaid: loan.status === 'paid',
      existingPenalty: existingPenalties[0] || 0
    });
  }
  
  setAddPenaltyDialog({
    isOpen: true,
    loanId: loan.id,
    currentNotes: loan.notes,
    installments
  });
  setSelectedPenaltyInstallment(null);
  setPenaltyAmount('');
};
```

### 3. Função para Salvar a Multa

Reutilizar a lógica existente do `handleEditDailyPenalty`:

```typescript
const handleSaveAddPenalty = async () => {
  if (!addPenaltyDialog || selectedPenaltyInstallment === null) return;
  
  const amount = parseFloat(penaltyAmount || '0');
  if (amount <= 0) {
    toast.error('Informe um valor válido para a multa');
    return;
  }
  
  await handleEditDailyPenalty(
    addPenaltyDialog.loanId,
    selectedPenaltyInstallment,
    amount,
    addPenaltyDialog.currentNotes
  );
  
  setAddPenaltyDialog(null);
  setSelectedPenaltyInstallment(null);
  setPenaltyAmount('');
};
```

### 4. Botão na Barra de Ações

Adicionar o botão junto aos outros (após o botão de "Editar", linha ~8659):

```tsx
{/* Botão para adicionar multa em qualquer parcela */}
{!isPaid && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button 
        variant={hasSpecialStyle ? 'secondary' : 'outline'} 
        size="icon" 
        className={`h-7 w-7 sm:h-8 sm:w-8 ${hasSpecialStyle ? 'bg-white/20 text-white hover:bg-white/30 border-white/30' : 'border-orange-500 text-orange-500 hover:bg-orange-500/10'}`}
        onClick={() => openAddPenaltyDialog(loan, totalPerInstallment)}
      >
        <DollarSign className="w-3 h-3" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">
      <p>Adicionar multa a uma parcela</p>
    </TooltipContent>
  </Tooltip>
)}
```

### 5. Novo Diálogo

Adicionar o diálogo após os outros dialogs existentes (~linha 13728):

```tsx
{/* Dialog para adicionar multa em qualquer parcela */}
<Dialog open={!!addPenaltyDialog} onOpenChange={() => {
  setAddPenaltyDialog(null);
  setSelectedPenaltyInstallment(null);
  setPenaltyAmount('');
}}>
  <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Adicionar Multa</DialogTitle>
      <DialogDescription>
        Selecione a parcela e informe o valor da multa a ser aplicada.
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Lista de parcelas para selecionar */}
      <div className="space-y-2">
        <Label>Selecione a parcela</Label>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {addPenaltyDialog?.installments.map((inst) => (
            <div 
              key={inst.index}
              onClick={() => !inst.isPaid && setSelectedPenaltyInstallment(inst.index)}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                inst.isPaid 
                  ? 'bg-green-500/10 opacity-50 cursor-not-allowed' 
                  : selectedPenaltyInstallment === inst.index 
                    ? 'bg-orange-500/20 border border-orange-400' 
                    : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Parcela {inst.index + 1} {inst.isPaid && '(Paga)'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Venc: {formatDate(inst.dueDate)} • Valor: {formatCurrency(inst.installmentValue)}
                </p>
              </div>
              {inst.existingPenalty > 0 && (
                <span className="text-xs text-orange-500 font-medium">
                  Multa: +{formatCurrency(inst.existingPenalty)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Campo de valor da multa */}
      {selectedPenaltyInstallment !== null && (
        <div className="space-y-2">
          <Label>Valor da multa (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Ex: 50.00"
            value={penaltyAmount}
            onChange={(e) => setPenaltyAmount(e.target.value)}
          />
          {parseFloat(penaltyAmount || '0') > 0 && (
            <p className="text-sm text-orange-500">
              Nova multa: +{formatCurrency(parseFloat(penaltyAmount))}
            </p>
          )}
        </div>
      )}
      
      {/* Botões */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => {
          setAddPenaltyDialog(null);
          setSelectedPenaltyInstallment(null);
          setPenaltyAmount('');
        }} className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={handleSaveAddPenalty} 
          className="flex-1"
          disabled={selectedPenaltyInstallment === null || parseFloat(penaltyAmount || '0') <= 0}
        >
          Aplicar Multa
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Loans.tsx` | Adicionar state para o novo diálogo |
| `src/pages/Loans.tsx` | Adicionar função `openAddPenaltyDialog` |
| `src/pages/Loans.tsx` | Adicionar função `handleSaveAddPenalty` |
| `src/pages/Loans.tsx` | Adicionar botão na barra de ações (ícone $) |
| `src/pages/Loans.tsx` | Adicionar o Dialog UI |

## Comportamento Esperado

1. O botão aparece para todos os empréstimos não pagos
2. Ao clicar, mostra lista de todas as parcelas
3. Parcelas já pagas ficam desabilitadas (cinza)
4. Parcelas com multa existente mostram o valor atual
5. Usuário seleciona parcela e digita valor
6. Ao salvar, adiciona tag `[DAILY_PENALTY:X:Y]` ao campo notes
7. Se já existia multa na parcela, substitui pelo novo valor

## Estimativa

- **Complexidade**: Média
- **Linhas adicionadas**: ~120
- **Risco**: Baixo (funcionalidade isolada, reutiliza lógica existente)
