

# Plano: Mostrar Juros Antigos Apenas para Empréstimos de 1 Parcela

## Objetivo

Limitar a funcionalidade de "Registros Históricos de Juros" para aparecer somente em empréstimos que possuem apenas **1 parcela**.

## Alterações Necessárias

### Localizações no Código

| Local | Linha | Tipo de Empréstimo |
|-------|-------|-------------------|
| src/pages/Loans.tsx | ~6507 | Empréstimos Diários |
| src/pages/Loans.tsx | ~7085 | Empréstimos Regulares (semanal/quinzenal/mensal) |

### Condição Atual

```tsx
{formData.is_historical_contract && formData.start_date && (
  <HistoricalInterestRecords ... />
)}
```

### Nova Condição

```tsx
{formData.is_historical_contract && formData.start_date && parseInt(formData.installments) === 1 && (
  <HistoricalInterestRecords ... />
)}
```

## Detalhes Técnicos

| Campo | Tipo | Valor para 1 Parcela |
|-------|------|---------------------|
| formData.installments | string | "1" |

A comparação usa `parseInt()` para garantir que a string "1" seja corretamente comparada com o número 1.

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| src/pages/Loans.tsx | Adicionar condição `parseInt(formData.installments) === 1` em 2 locais |

## Comportamento Esperado

| Parcelas | Contrato Histórico | Mostra "Juros Antigos"? |
|----------|-------------------|------------------------|
| 1 | Sim | Sim |
| 1 | Não | Não |
| 2+ | Sim | Não |
| 2+ | Não | Não |

## Testes Recomendados

1. Criar empréstimo mensal com 1 parcela e data histórica
   - Componente "Registros Históricos de Juros" deve aparecer

2. Criar empréstimo mensal com 2+ parcelas e data histórica
   - Componente NÃO deve aparecer

3. Criar empréstimo diário com 1 parcela e data histórica
   - Componente deve aparecer

4. Criar empréstimo diário com 5 parcelas e data histórica
   - Componente NÃO deve aparecer

