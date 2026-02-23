

## Corrigir validacao de juros no modo "Parcelas Personalizadas"

### Problema

Quando o usuario seleciona o modo "Parcelas Personalizadas" (`custom`), o campo de taxa de juros esta escondido (correto), porem a validacao na submissao do formulario ainda exige que `interest_rate` seja preenchido. Como o campo esta vazio, o sistema mostra "Informe a taxa de juros" e bloqueia a criacao.

O calculo de juros total ja esta correto no codigo (soma das parcelas - principal), mas a validacao impede que o formulario seja submetido.

### Solucao

Uma unica alteracao no arquivo `src/pages/Loans.tsx`:

**Arquivo: `src/pages/Loans.tsx` (~linha 3820-3828)**

Pular a validacao de taxa de juros quando o modo for `custom`, ja que nesse modo os juros sao calculados automaticamente a partir dos valores das parcelas:

```typescript
// Permitir taxa de juros 0% (zero é um valor válido)
// Para custom, a taxa não se aplica - pular validação
if (formData.interest_mode !== 'custom') {
  const interestRateValue = formData.interest_rate !== '' && formData.interest_rate !== undefined && formData.interest_rate !== null
    ? parseFloat(String(formData.interest_rate))
    : NaN;
  if (isNaN(interestRateValue) || interestRateValue < 0) {
    toast.error('Informe a taxa de juros (pode ser 0%)');
    setIsCreatingLoan(false);
    return;
  }
}
```

Isso e suficiente porque o restante do codigo ja trata corretamente o modo `custom`:
- Linha 3864-3877: calcula `totalInterest = customTotal - principal` e define `rate = 0`
- Linha 7337: esconde o campo de taxa de juros
- Linha 7392: esconde o campo "Juros Total"
- Linha 7406-7443: exibe os inputs individuais e o resumo automatico

