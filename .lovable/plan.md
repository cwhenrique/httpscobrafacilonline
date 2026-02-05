
# Plano: Ordenação por Urgência + Alterar Data no Editar Assinatura

## Resumo

Implementar duas melhorias na página de assinaturas IPTV:

1. **Ordenar assinaturas por urgência** — assinaturas com vencimento mais próximo (especialmente atrasadas) aparecem primeiro
2. **Botão "Alterar Data" no modal Editar Assinatura** — permite mudar a data de vencimento e atualiza tanto o `due_day` quanto o pagamento pendente atual

---

## 1. Ordenar Assinaturas por Urgência

### O que muda

Atualmente a lista `filteredSubscriptions` não tem ordenação específica. Vou adicionar ordenação com a seguinte prioridade:

| Prioridade | Status | Ordenação Secundária |
|------------|--------|---------------------|
| 1️⃣ | Atrasados (`overdue`) | Mais antigo primeiro (vence há mais tempo) |
| 2️⃣ | Vence Hoje (`due_today`) | — |
| 3️⃣ | Pendentes (`pending`) | Vencimento mais próximo primeiro |
| 4️⃣ | Pagos (`paid`) | Por nome do cliente |

### Arquivo: `src/pages/ProductSales.tsx`

**Antes (linha ~1276):**
```typescript
const filteredSubscriptions = monthlyFees.filter(fee => {
  // ...filtro de status
});
```

**Depois:**
```typescript
const filteredSubscriptions = monthlyFees
  .filter(fee => {
    // ...filtro de status (mesmo código)
  })
  .sort((a, b) => {
    const statusA = getSubscriptionStatus(a);
    const statusB = getSubscriptionStatus(b);
    
    // Prioridade de status
    const priority = { overdue: 0, due_today: 1, pending: 2, paid: 3 };
    if (priority[statusA] !== priority[statusB]) {
      return priority[statusA] - priority[statusB];
    }
    
    // Dentro do mesmo status, ordenar por data de vencimento
    const paymentA = getNextPendingPayment(a.id);
    const paymentB = getNextPendingPayment(b.id);
    
    if (paymentA && paymentB) {
      return new Date(paymentA.due_date).getTime() - new Date(paymentB.due_date).getTime();
    }
    
    // Fallback: ordenar por nome
    return (a.client?.full_name || '').localeCompare(b.client?.full_name || '');
  });
```

---

## 2. Botão "Alterar Data" no Modal Editar Assinatura

### O que muda

Adicionar um campo/botão no dialog de edição que permite alterar a data de vencimento:
- Selecionar uma nova data no calendário
- Ao salvar, atualiza o `due_day` da assinatura
- Também atualiza o `due_date` do pagamento pendente atual (se houver)

### Arquivo: `src/pages/ProductSales.tsx`

**1) Adicionar estado para nova data:**
```typescript
const [editSubscriptionNewDueDate, setEditSubscriptionNewDueDate] = useState<Date | undefined>(undefined);
```

**2) No dialog (linhas 3563-3642), adicionar seção para alterar data:**

```tsx
{/* Nova seção: Alterar Data de Vencimento */}
<div className="space-y-2">
  <Label>Alterar Data de Vencimento</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="w-full justify-start">
        <Calendar className="w-4 h-4 mr-2" />
        {editSubscriptionNewDueDate 
          ? format(editSubscriptionNewDueDate, 'dd/MM/yyyy', { locale: ptBR })
          : 'Selecionar nova data'
        }
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
      <CalendarComponent
        mode="single"
        selected={editSubscriptionNewDueDate}
        onSelect={setEditSubscriptionNewDueDate}
        locale={ptBR}
        className="pointer-events-auto"
      />
    </PopoverContent>
  </Popover>
  <p className="text-xs text-muted-foreground">
    Isso atualizará o dia de vencimento e a cobrança pendente atual.
  </p>
</div>
```

**3) Atualizar o `onClick` do botão Salvar para aplicar a nova data:**

```typescript
onClick={async () => {
  if (editingSubscriptionId) {
    // Calcular novo due_day a partir da data selecionada
    let newDueDay = editSubscriptionForm.due_day;
    if (editSubscriptionNewDueDate) {
      newDueDay = Math.min(getDate(editSubscriptionNewDueDate), 28);
    }
    
    // Atualizar a assinatura (due_day)
    await updateFee.mutateAsync({
      id: editingSubscriptionId,
      data: { ...editSubscriptionForm, due_day: newDueDay },
    });
    
    // Se uma nova data foi selecionada, atualizar o pagamento pendente
    if (editSubscriptionNewDueDate) {
      const pendingPayment = getNextPendingPayment(editingSubscriptionId);
      if (pendingPayment) {
        await updateFeePayment.mutateAsync({
          paymentId: pendingPayment.id,
          data: { due_date: format(editSubscriptionNewDueDate, 'yyyy-MM-dd') }
        });
      }
    }
    
    setEditingSubscriptionId(null);
    setEditSubscriptionNewDueDate(undefined);
  }
}}
```

**4) Limpar estado ao abrir/fechar dialog:**

Quando abrir o dialog (ao clicar em "Editar Valor"):
```typescript
setEditSubscriptionNewDueDate(undefined);
```

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/ProductSales.tsx` | Adicionar `.sort()` após o filter de assinaturas |
| `src/pages/ProductSales.tsx` | Novo estado `editSubscriptionNewDueDate` |
| `src/pages/ProductSales.tsx` | Adicionar campo calendário no dialog de edição |
| `src/pages/ProductSales.tsx` | Atualizar lógica de salvar para aplicar nova data |

---

## Comportamento Esperado

1. **Lista de assinaturas ordenada:**
   - Atrasadas aparecem primeiro (mais antiga no topo)
   - Depois vence hoje
   - Depois pendentes (mais próxima no topo)
   - Por último, as quitadas

2. **Ao editar assinatura e selecionar nova data:**
   - O `due_day` da assinatura é atualizado (ex: se selecionar 15/03, due_day vira 15)
   - O `due_date` do pagamento pendente atual muda para a data selecionada
   - Renovações futuras seguirão o novo `due_day`
