

## Correção: Valor da Parcela e Lista de Vencimentos para SAC

### Problemas

1. **"Valor da Parcela (R$)" mostra 3200 (média)** - Na linha 2336, o cálculo faz `total / numInstallments`, que dá a média. Para SAC, deveria mostrar o valor da **primeira parcela** (4000 no exemplo).

2. **Lista "Vencimento das Parcelas" não mostra valores individuais** - Linhas 7476-7485 mostram apenas "Parc. 1 | data". Para SAC, cada linha deveria exibir também o valor daquela parcela específica (ex: "Parc. 1 | data | R$ 4.000").

3. **"Total a Receber" usa `installmentValue * parcelas`** - Linha 7288-7290 calcula errado para SAC pois multiplica o valor da primeira parcela pelo total. Precisa somar os valores reais de cada parcela SAC.

### Correções

**1. `src/pages/Loans.tsx` - Linha 2327-2336 - useEffect do installmentValue**

Para SAC, em vez de `total / numInstallments`, mostrar o valor da primeira parcela:

```typescript
if (formData.interest_mode === 'sac') {
  const firstInstallment = calculateSACInstallmentValue(principal, rate, numInstallments, 0);
  setInstallmentValue(firstInstallment.toFixed(2));
} else {
  setInstallmentValue((total / numInstallments).toFixed(2));
}
```

**2. `src/pages/Loans.tsx` - Linha 7274 - Label do campo**

Para SAC, mudar label para "1a Parcela (R$)" para indicar que é o valor da primeira (e não de todas):

```typescript
<Label>
  {formData.interest_mode === 'sac' 
    ? '1ª Parcela (R$)' 
    : `Valor da ${...} (R$)`}
</Label>
```

**3. `src/pages/Loans.tsx` - Linhas 7476-7485 - Lista de vencimentos**

Adicionar o valor individual de cada parcela ao lado da data:

```typescript
{installmentDates.map((date, index) => (
  <div key={index} className="flex items-center gap-2 sm:gap-3">
    <span className="text-xs sm:text-sm font-medium w-16 sm:w-20">
      Parc. {index + 1}
    </span>
    <Input type="date" value={date} ... className="flex-1" />
    {formData.interest_mode === 'sac' && formData.principal_amount && formData.interest_rate && (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatCurrency(calculateSACInstallmentValue(
          parseFloat(formData.principal_amount),
          parseFloat(formData.interest_rate),
          parseInt(formData.installments) || 1,
          index
        ))}
      </span>
    )}
  </div>
))}
```

**4. `src/pages/Loans.tsx` - Linhas 7288-7290 - "Total a Receber"**

Para SAC, calcular a soma real de todas as parcelas em vez de `installmentValue * parcelas`:

```typescript
value={(() => {
  if (formData.interest_mode === 'sac' && formData.principal_amount && formData.interest_rate && formData.installments) {
    const { totalPayment } = generateSACTable(
      parseFloat(formData.principal_amount),
      parseFloat(formData.interest_rate),
      parseInt(formData.installments)
    );
    return formatCurrency(totalPayment);
  }
  return installmentValue && formData.installments
    ? formatCurrency(parseFloat(installmentValue) * parseInt(formData.installments))
    : 'R$ 0,00';
})()}
```

### Impacto
- O campo "Valor da Parcela" mostrara R$ 4.000 (primeira parcela) em vez de R$ 3.200 (media)
- Cada linha da lista de vencimentos mostrara o valor individual daquela parcela
- "Total a Receber" continuara correto (soma real das parcelas SAC)
- O label mudara para "1a Parcela" quando SAC estiver selecionado, deixando claro que as demais parcelas tem valores diferentes

