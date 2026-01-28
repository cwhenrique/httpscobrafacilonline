
# Plano: Pagamento Parcial de Juros

## Resumo da Solicitacao

Adicionar um **novo botao** no dialogo "Renegociar Divida" para registrar pagamentos **parciais de juros**, mantendo o botao existente "Cliente pagou so os juros" inalterado.

**Exemplo do usuario:**
- Emprestimo de R$ 10.000 a 10% para vencer dia 25/01
- Juros total da parcela seria R$ 1.000
- Cliente paga R$ 500 de juros no dia 07/01
- Ficam R$ 500 de juros em aberto ate quitar

## Diferenca entre as Funcoes

| Funcao Existente (Juros Completo) | Nova Funcao (Juros Parcial) |
|-----------------------------------|------------------------------|
| Cliente paga 100% dos juros | Cliente paga parte dos juros |
| Rola vencimento para proximo periodo | **NAO** rola datas |
| Saldo devedor permanece igual | Registra juros pendente |
| Registra com tag `[INTEREST_ONLY_PAYMENT]` | Registra com tag `[PARTIAL_INTEREST_PAYMENT]` |

## Alteracoes a Implementar

### 1. Remover Opcao "Aplicar Juros Extra em Parcela"

Remover completamente:
- Botao (linhas ~12127-12171)
- Formulario da opcao `activeOption === 'fee'` (linhas ~12264-12443)
- Logica de processamento para `renewal_fee_enabled` (linhas ~4648-4721)

### 2. Adicionar Estado para Pagamento Parcial de Juros

Modificar o estado `renegotiateData` (linha ~847) para incluir:

```typescript
partial_interest_enabled: false,
partial_interest_amount: '',
partial_interest_installment: '0',
partial_interest_date: format(new Date(), 'yyyy-MM-dd'),
```

### 3. Adicionar Novo Botao no UI

Adicionar um terceiro botao com cor cyan/azul claro no grid de opcoes (apos "Cliente pagou so os juros"):

- Titulo: **"Pagamento parcial de juros"**
- Descricao: "Registrar pagamento de parte dos juros de uma parcela"
- Cor: Cyan (`border-cyan-500`, `bg-cyan-500/10`)

Este botao aparece apenas para emprestimos parcelados, semanais ou quinzenais.

### 4. Adicionar Formulario para Pagamento Parcial

Quando `activeOption === 'partial_interest'`:

**Campos do formulario:**
1. **Valor pago (R$)** - Input editavel
2. **Parcela referente** - Select com todas as parcelas nao quitadas
3. **Data do pagamento** - Input de data

**Resumo visual:**
- Exibir valor de juros total da parcela selecionada
- Exibir valor pago
- Exibir valor de juros que fica pendente (calculado automaticamente)

### 5. Logica de Processamento

**Ao submeter pagamento parcial de juros:**

1. Registrar pagamento em `loan_payments` com:
   - `amount`: valor pago
   - `principal_paid`: 0 (nao afeta principal)
   - `interest_paid`: valor pago
   - `notes`: `[PARTIAL_INTEREST_PAYMENT]`

2. Adicionar tag no notes do emprestimo:
   ```
   [PARTIAL_INTEREST_PENDING:indice_parcela:valor_pendente:data_pagamento]
   ```

3. Atualizar `total_paid` com o valor pago

4. **NAO** alterar `remaining_balance` (juros parcial nao abate saldo)

5. **NAO** rolar datas de vencimento

### 6. Rastreamento de Juros Pendentes

**Formato da tag:**
```
[PARTIAL_INTEREST_PENDING:0:500.00:2026-01-07]
```

Onde:
- `0` = indice da parcela (0-indexed)
- `500.00` = valor de juros ainda pendente
- `2026-01-07` = data do pagamento parcial

**Quando cliente quitar os juros pendentes:**
- Sistema pode usar o fluxo normal de pagamento de juros
- Ou criar outra entrada de pagamento parcial ate zerar

---

## Secao Tecnica

### Arquivo Principal: src/pages/Loans.tsx

#### 1. Adicionar Helper Function (topo do arquivo, ~linha 170)

```typescript
// Helper para extrair pagamentos parciais de juros pendentes
// Formato: [PARTIAL_INTEREST_PENDING:indice:valor:data]
const getPartialInterestPendingFromNotes = (notes: string | null): Array<{
  installmentIndex: number;
  pendingAmount: number;
  paymentDate: string;
}> => {
  const pending: Array<{ installmentIndex: number; pendingAmount: number; paymentDate: string }> = [];
  const matches = (notes || '').matchAll(/\[PARTIAL_INTEREST_PENDING:(\d+):([0-9.]+):([^\]]+)\]/g);
  for (const match of matches) {
    pending.push({
      installmentIndex: parseInt(match[1]),
      pendingAmount: parseFloat(match[2]),
      paymentDate: match[3]
    });
  }
  return pending;
};
```

#### 2. Atualizar Estado renegotiateData (~linha 847)

Adicionar campos:
```typescript
partial_interest_enabled: false,
partial_interest_amount: '',
partial_interest_installment: '0',
partial_interest_date: format(new Date(), 'yyyy-MM-dd'),
```

#### 3. Atualizar activeOption Logic (~linha 12031)

```typescript
const activeOption = renegotiateData.interest_only_paid ? 'interest' : 
                     renegotiateData.partial_interest_enabled ? 'partial_interest' :
                     renegotiateData.renewal_fee_enabled ? 'fee' : null;
```

Depois remover a opcao 'fee' completamente.

#### 4. Adicionar Novo Botao (~linha 12127)

Apos o botao "Cliente pagou so os juros", adicionar:

```tsx
{(selectedLoan.payment_type === 'installment' || selectedLoan.payment_type === 'weekly' || selectedLoan.payment_type === 'biweekly') && (
  <button
    type="button"
    onClick={() => {
      setRenegotiateData({ 
        ...renegotiateData, 
        interest_only_paid: false,
        renewal_fee_enabled: false,
        partial_interest_enabled: true,
        partial_interest_installment: '0',
        partial_interest_amount: '',
        partial_interest_date: format(new Date(), 'yyyy-MM-dd'),
      });
    }}
    className="p-4 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors text-left"
  >
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-full bg-cyan-500/20">
        <DollarSign className="h-6 w-6 text-cyan-500" />
      </div>
      <div>
        <p className="font-semibold text-cyan-500">Pagamento parcial de juros</p>
        <p className="text-sm text-muted-foreground">Registrar pagamento de parte dos juros de uma parcela</p>
      </div>
    </div>
  </button>
)}
```

#### 5. Adicionar Formulario para Opcao partial_interest (~apos linha 12262)

```tsx
{/* Opcao 3: Pagamento Parcial de Juros */}
{activeOption === 'partial_interest' && (
  <div className="space-y-4 border-2 border-cyan-500 rounded-lg p-4 bg-cyan-950/50">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-cyan-500" />
        <span className="font-semibold text-cyan-500">Pagamento Parcial de Juros</span>
      </div>
      <Button 
        type="button" 
        variant="ghost" 
        size="sm"
        onClick={() => setRenegotiateData({ ...renegotiateData, partial_interest_enabled: false })}
        className="text-muted-foreground hover:text-white"
      >
        ← Voltar
      </Button>
    </div>
    
    {/* Select de parcela */}
    <div className="space-y-2">
      <Label className="text-cyan-300 text-xs">Parcela referente:</Label>
      <Select 
        value={renegotiateData.partial_interest_installment} 
        onValueChange={(v) => setRenegotiateData({ ...renegotiateData, partial_interest_installment: v })}
      >
        <SelectTrigger className="bg-cyan-950 text-white border-cyan-500">
          <SelectValue placeholder="Selecione a parcela" />
        </SelectTrigger>
        <SelectContent>
          {/* Listar parcelas nao totalmente pagas */}
          {dates.map((date, index) => {
            if (isInstallmentPaid(index)) return null;
            return (
              <SelectItem key={index} value={index.toString()}>
                Parcela {index + 1} - {formatDate(date)} - Juros: {formatCurrency(interestPerInstallment)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-cyan-300 text-xs">Valor pago (R$) *</Label>
        <Input 
          type="number" 
          step="0.01" 
          value={renegotiateData.partial_interest_amount} 
          onChange={(e) => setRenegotiateData({ ...renegotiateData, partial_interest_amount: e.target.value })} 
          placeholder="Ex: 500,00"
          required
          className="bg-cyan-950 text-white border-cyan-500 font-bold"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-cyan-300 text-xs">Data do pagamento *</Label>
        <Input 
          type="date" 
          value={renegotiateData.partial_interest_date} 
          onChange={(e) => setRenegotiateData({ ...renegotiateData, partial_interest_date: e.target.value })} 
          required
          className="bg-cyan-950 text-white border-cyan-500"
        />
      </div>
    </div>
    
    {/* Resumo */}
    <div className="bg-cyan-500/20 rounded-lg p-4 space-y-2 border border-cyan-500">
      <div className="flex justify-between items-center">
        <span className="text-cyan-300 text-sm">Juros total da parcela:</span>
        <span className="font-bold text-white">{formatCurrency(interestPerInstallment)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-cyan-300 text-sm">Valor pago agora:</span>
        <span className="font-bold text-green-400">{formatCurrency(parseFloat(renegotiateData.partial_interest_amount) || 0)}</span>
      </div>
      <div className="flex justify-between items-center border-t border-cyan-500/50 pt-2">
        <span className="text-cyan-400 font-medium">Juros pendente:</span>
        <span className="text-xl font-bold text-amber-400">
          {formatCurrency(Math.max(0, interestPerInstallment - (parseFloat(renegotiateData.partial_interest_amount) || 0)))}
        </span>
      </div>
    </div>
    
    <p className="text-xs text-cyan-300/70">
      O saldo devedor e datas de vencimento nao serao alterados. Apenas sera registrado o pagamento parcial dos juros.
    </p>
  </div>
)}
```

#### 6. Adicionar Logica de Submit para partial_interest (~linha 4467)

No `handleRenegotiateSubmit`, adicionar ANTES do `else if (renegotiateData.renewal_fee_enabled)`:

```typescript
else if (renegotiateData.partial_interest_enabled && renegotiateData.partial_interest_amount) {
  const partialAmount = parseFloat(renegotiateData.partial_interest_amount);
  const installmentIndex = parseInt(renegotiateData.partial_interest_installment);
  const paymentDate = renegotiateData.partial_interest_date || format(new Date(), 'yyyy-MM-dd');
  
  // Calcular juros pendente
  const interestPerInstallment = baseTotalInterest / numInstallments;
  const pendingInterest = Math.max(0, interestPerInstallment - partialAmount);
  
  // Registrar pagamento
  const paymentResult = await registerPayment({
    loan_id: selectedLoanId,
    amount: partialAmount,
    principal_paid: 0,
    interest_paid: partialAmount,
    payment_date: paymentDate,
    notes: `[PARTIAL_INTEREST_PAYMENT] Pagamento parcial de juros da parcela ${installmentIndex + 1}`,
    send_notification: false,
  });
  
  if (paymentResult.error) {
    console.error('[PARTIAL_INTEREST_ERROR] Falha ao registrar:', paymentResult.error);
    toast.error('Erro ao registrar pagamento parcial de juros');
    return;
  }
  
  // Atualizar notas com tag de rastreamento
  let notesText = loan.notes || '';
  notesText += `\n[PARTIAL_INTEREST_PENDING:${installmentIndex}:${pendingInterest.toFixed(2)}:${paymentDate}]`;
  notesText += `\nPagamento parcial de juros: R$ ${partialAmount.toFixed(2)} em ${formatDate(paymentDate)} (Parcela ${installmentIndex + 1})`;
  
  // NAO alterar remaining_balance nem datas - apenas atualizar notes
  await supabase.from('loans').update({
    notes: notesText,
    updated_at: new Date().toISOString()
  }).eq('id', selectedLoanId);
  
  toast.success(`Pagamento parcial de R$ ${formatCurrency(partialAmount)} registrado. Juros pendente: ${formatCurrency(pendingInterest)}`);
  
  setIsRenegotiateDialogOpen(false);
  setSelectedLoanId(null);
  return;
}
```

#### 7. Remover Codigo da Opcao "Aplicar Juros Extra"

- Remover botao (~linhas 12127-12171)
- Remover formulario `activeOption === 'fee'` (~linhas 12264-12443)
- Remover logica de submit `renewal_fee_enabled` (~linhas 4648-4721)
- Manter campos no estado para backward compatibility mas nao usar

### Fluxo de Dados Resumido

```
Usuario clica "Pagamento parcial de juros"
         |
         v
Seleciona parcela referente
         |
         v
Digita valor pago (ex: R$ 500)
         |
         v
Sistema calcula: juros_pendente = juros_parcela - valor_pago
         |
         v
Ao submeter:
  - Registra loan_payment com interest_paid = 500
  - Adiciona tag [PARTIAL_INTEREST_PENDING:0:500:2026-01-07]
  - Atualiza total_paid (NAO muda remaining_balance)
  - NAO rola datas
         |
         v
No proximo momento:
  - Sistema exibe juros pendente acumulado
  - Usuario pode pagar o restante
```

### Validacoes

1. Valor pago deve ser > 0
2. Valor pago deve ser < valor total dos juros da parcela
3. Se valor pago >= juros total, exibir mensagem sugerindo usar "Cliente pagou so os juros"
4. Parcela selecionada deve existir e nao estar totalmente quitada

### Migracao de Dados

Nenhuma migracao necessaria - feature usa apenas tags no campo `notes` existente.
