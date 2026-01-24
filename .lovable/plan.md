
## Plano: Corrigir Amortização para Empréstimos Diários

### Diagnóstico
O empréstimo do **BRUNO BEZERRA** não aparece na lista porque a lógica de amortização corrompeu seus dados:

| Campo | Valor Atual (incorreto) | Valor Esperado |
|-------|------------------------|----------------|
| `principal_amount` | R$ 950,00 | R$ 950,00 ✓ |
| `total_interest` | R$ 50,00 | ~R$ 47,50/parcela |
| `remaining_balance` | R$ 0,00 | R$ 950 + juros |
| `total_paid` | R$ 50,00 | R$ 50,00 ✓ |

O problema: O cálculo de amortização (linha 3833) usa `newPrincipal * (interestRate / 100)`, que funciona para empréstimos mensais mas **não para diários** onde `total_interest` representa o valor da parcela diária.

---

### Correção 1: Ajustar Lógica de Amortização para Empréstimos Diários
**Arquivo:** `src/pages/Loans.tsx` (linhas 3815-3870)

Adicionar verificação do tipo de pagamento antes de calcular amortização:

```typescript
if (paymentData.recalculate_interest && paymentData.payment_type === 'partial') {
  const isDaily = selectedLoan.payment_type === 'daily';
  
  if (isDaily) {
    // Para empréstimos diários, amortização não faz sentido da mesma forma
    // total_interest é o valor da parcela, não o total de juros
    toast.error('Amortização não disponível para empréstimos diários', {
      description: 'Use pagamento parcial normal para este tipo de empréstimo.'
    });
    return;
  }
  
  // ... resto da lógica de amortização (apenas para não-diários)
}
```

---

### Correção 2: Corrigir Dados do Empréstimo Corrompido
**Opção A - Script de correção manual:**

Criar uma edge function ou usar SQL direto para corrigir o empréstimo específico:

```sql
-- Restaurar valores originais do empréstimo BRUNO BEZERRA
UPDATE loans 
SET 
  principal_amount = 1000.00,  -- Valor original
  total_interest = 50.00,      -- Valor da parcela diária original
  remaining_balance = 1150.00, -- 1000 + (50 * 25 parcelas) - 50 (pago)
  total_paid = 0.00,           -- Remover amortização incorreta
  notes = NULL                 -- Limpar tags de amortização
WHERE id = 'b70c660b-1ff0-461b-b24c-1dd3bf09e884';

-- Deletar pagamento de amortização incorreto
DELETE FROM loan_payments 
WHERE id = '889f344e-f56c-4495-8523-9a6820d02ce7';
```

**Opção B - Adicionar botão de "Corrigir Empréstimo" para o admin:**

Adicionar funcionalidade para restaurar empréstimo usando os valores de `[AMORT_REVERSAL]` nas notas do pagamento.

---

### Correção 3: Bloquear Amortização no Formulário de Pagamento
**Arquivo:** `src/pages/Loans.tsx`

Esconder ou desabilitar a opção "Recalcular juros (amortização)" quando o empréstimo for do tipo `daily`:

```tsx
{/* Checkbox de amortização - só para não-diários */}
{selectedLoan?.payment_type !== 'daily' && (
  <div className="flex items-center space-x-2">
    <Checkbox 
      id="recalculate_interest"
      checked={paymentData.recalculate_interest}
      onCheckedChange={(checked) => setPaymentData(prev => ({ 
        ...prev, 
        recalculate_interest: checked === true 
      }))}
    />
    <Label htmlFor="recalculate_interest">
      Recalcular juros (amortização)
    </Label>
  </div>
)}
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Loans.tsx` | 1. Bloquear amortização para empréstimos diários |
| `src/pages/Loans.tsx` | 2. Esconder checkbox de amortização para tipo 'daily' |
| SQL/Edge Function | 3. Corrigir dados do empréstimo BRUNO BEZERRA |

---

### Impacto
- Empréstimos diários não poderão mais ser corrompidos por amortização incorreta
- O empréstimo do BRUNO BEZERRA voltará a aparecer na lista após correção dos dados
- Contador do tab e lista ficarão sincronizados
