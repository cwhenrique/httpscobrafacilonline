
# Plano: Corrigir Badge "Atrasado" em Contratos Historicos

## Problema Identificado

O badge "Atrasado" aparece incorretamente porque o codigo esta usando `loan.status` do banco de dados em vez do `isOverdue` calculado pela funcao `getLoanStatus()`.

### Evidencia

Na imagem fornecida:
- Card esta ROXO (correto - `getCardStyle` funciona)
- Data de vencimento mostra **15/02/2026** (futuro)
- Badge mostra "Atrasado" (incorreto)

### Causa Raiz

Linha 8030-8031 do `src/pages/Loans.tsx`:
```tsx
<Badge className={...getPaymentStatusColor(loan.status)}>
  {isInterestOnlyPayment && !isOverdue ? 'Só Juros' : ... : getPaymentStatusLabel(loan.status)}
</Badge>
```

O codigo usa `loan.status` do banco de dados (que tem valor `'overdue'`) em vez de usar o `isOverdue` calculado pela funcao `getLoanStatus()` (que retorna `false` corretamente para contratos historicos com data futura).

### Por que o status no banco esta errado?

O campo `status` no banco foi definido como `'overdue'` em algum momento anterior (talvez durante a criacao ou por uma trigger antiga) e nao foi atualizado quando corrigimos a logica de datas.

## Solucao

### Opcao 1: Corrigir o Badge no Frontend (Recomendada)

Alterar o badge para usar a logica calculada `isOverdue` em vez de `loan.status`:

```tsx
// ANTES (linha 8030-8031):
<Badge className={`... ${hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(loan.status)}`}>
  {isInterestOnlyPayment && !isOverdue ? 'Só Juros' : isRenegotiated && !isOverdue ? 'Reneg.' : getPaymentStatusLabel(loan.status)}
</Badge>

// DEPOIS:
// Calcular o status CORRETO baseado em isOverdue/isPaid calculados
const displayStatus = isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending';

<Badge className={`... ${hasSpecialStyle ? 'bg-white/20 text-white border-white/30' : getPaymentStatusColor(displayStatus)}`}>
  {isInterestOnlyPayment && !isOverdue ? 'Só Juros' : isRenegotiated && !isOverdue ? 'Reneg.' : getPaymentStatusLabel(displayStatus)}
</Badge>
```

### Opcao 2: Adicionar Logica Especifica para Historical Interest Contracts

Para contratos historicos com juros, sempre mostrar "Só Juros" no badge quando nao estiver realmente em atraso:

```tsx
// Logica especial para contratos historicos
const badgeLabel = (() => {
  if (isPaid) return 'Pago';
  if (isHistoricalInterestContract && !isOverdue) return 'Juros Antigos';
  if (isInterestOnlyPayment && !isOverdue) return 'Só Juros';
  if (isRenegotiated && !isOverdue) return 'Reneg.';
  if (isOverdue) return 'Atrasado';
  return 'Pendente';
})();

const badgeStyle = (() => {
  if (isPaid) return 'bg-primary/20 text-primary border-primary/30';
  if (isHistoricalInterestContract && !isOverdue) return 'bg-purple-600/30 text-purple-300 border-purple-500/50';
  if (isOverdue) return 'bg-destructive text-destructive-foreground';
  return 'bg-secondary text-secondary-foreground';
})();
```

## Arquivos Afetados

| Arquivo | Localizacao | Alteracao |
|---------|-------------|-----------|
| src/pages/Loans.tsx | Linha 8030-8031 | Usar displayStatus em vez de loan.status |

## Codigo Detalhado

Adicionar antes do JSX (aproximadamente linha 7890, junto com outras variaveis):

```tsx
// 🆕 Calcular status de exibição baseado na lógica calculada, NÃO no banco
const displayStatus = isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending';
```

Alterar o Badge (linha 8030-8031):

```tsx
<Badge className={`text-[8px] sm:text-[10px] px-1 sm:px-1.5 ${
  hasSpecialStyle ? 'bg-white/20 text-white border-white/30' 
  : isHistoricalInterestContract && !isPaid && !isOverdue 
    ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
    : getPaymentStatusColor(displayStatus)
}`}>
  {isHistoricalInterestContract && !isPaid && !isOverdue 
    ? 'Juros Antigos' 
    : isInterestOnlyPayment && !isOverdue 
      ? 'Só Juros' 
      : isRenegotiated && !isOverdue 
        ? 'Reneg.' 
        : getPaymentStatusLabel(displayStatus)}
</Badge>
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Badge: "Atrasado" (vermelho) | Badge: "Juros Antigos" (roxo) |
| Cor do badge: vermelho | Cor do badge: roxo |

## Testes Recomendados

1. Verificar contrato historico com juros criado com data 15/01/2025
   - Badge deve mostrar "Juros Antigos" em roxo
   - Nao deve aparecer "Atrasado"

2. Verificar contrato normal em atraso
   - Badge deve continuar mostrando "Atrasado" em vermelho

3. Verificar contrato quitado
   - Badge deve mostrar "Pago"
