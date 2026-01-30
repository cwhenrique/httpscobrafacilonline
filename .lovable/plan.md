
# Plano: Corrigir Registros Históricos de Juros

## Problemas Identificados

### Problema 1: Só aparece 1 parcela
O componente `HistoricalInterestRecords` está usando `installmentDates` que vem do campo "Número de Parcelas" do formulário. Se o usuário define apenas 1 parcela, só 1 data é gerada, mesmo que o empréstimo tenha começado há 1 ano.

**Exemplo atual:**
- Data início: 30/01/2025
- Data atual: 30/01/2026
- Número de parcelas: 1 (definido pelo usuário)
- Resultado: 1 parcela histórica (incorreto - deveria mostrar 12)

### Problema 2: Juros não é editável
O valor do juros é calculado automaticamente e não há campo para o usuário editar individualmente.

## Solução Proposta

### 1. Calcular Parcelas Passadas Automaticamente

Em vez de depender do número de parcelas informado pelo usuário, o sistema deve calcular quantas parcelas **cabem no período passado** desde a data de início até hoje.

**Nova lógica:**
```
parcelas_passadas = diferença_em_meses(data_inicio, hoje)
```

Por exemplo, se o empréstimo começou em 30/01/2025 e hoje é 30/01/2026:
- Diferença: 12 meses
- Parcelas passadas: 12

### 2. Tornar Juros Editável por Parcela

Adicionar um estado para armazenar valores de juros editados por parcela:
```typescript
const [customInterestAmounts, setCustomInterestAmounts] = useState<Record<number, number>>({});
```

Permitir que o usuário clique no valor de juros de cada parcela e edite-o.

## Alterações Necessárias

### Arquivo: src/components/HistoricalInterestRecords.tsx

**Alteração 1**: Receber `startDate` e `paymentFrequency` como props em vez de `installmentDates`

**Alteração 2**: Calcular internamente as datas das parcelas passadas desde a data de início até hoje

**Alteração 3**: Adicionar prop para juros editáveis:
- `customInterestAmounts: Record<number, number>`
- `onInterestChange: (index: number, amount: number) => void`

**Alteração 4**: Renderizar input editável para cada parcela

### Arquivo: src/pages/Loans.tsx

**Alteração 1**: Adicionar estado para juros customizados:
```typescript
const [customHistoricalInterestAmounts, setCustomHistoricalInterestAmounts] = useState<Record<number, number>>({});
```

**Alteração 2**: Passar novas props para o componente `HistoricalInterestRecords`:
```tsx
<HistoricalInterestRecords
  startDate={formData.start_date}
  paymentFrequency={formData.payment_type === 'daily' ? 'daily' : 
                   formData.payment_type === 'weekly' ? 'weekly' :
                   formData.payment_type === 'biweekly' ? 'biweekly' : 'monthly'}
  principalAmount={...}
  interestRate={...}
  customInterestAmounts={customHistoricalInterestAmounts}
  onInterestChange={(idx, amount) => setCustomHistoricalInterestAmounts(prev => ({...prev, [idx]: amount}))}
  selectedIndices={selectedHistoricalInterestInstallments}
  onSelectionChange={setSelectedHistoricalInterestInstallments}
/>
```

**Alteração 3**: Atualizar `handleSubmit` para usar os valores de juros customizados ao registrar pagamentos

## Nova Interface de Registros Históricos

```text
+------------------------------------------------------------------+
|  REGISTROS HISTÓRICOS DE JUROS                                   |
|  Este contrato possui 12 parcelas anteriores à data atual        |
+------------------------------------------------------------------+
|                                                                   |
|  [Todas]  [Nenhuma]                                              |
|                                                                   |
|  +--------------------------------------------------------------+|
|  | [x] Parcela 1 - 30/01/2025    Juros: [R$ 100,00]  ← EDITÁVEL ||
|  | [x] Parcela 2 - 28/02/2025    Juros: [R$ 100,00]  ← EDITÁVEL ||
|  | [x] Parcela 3 - 30/03/2025    Juros: [R$ 100,00]  ← EDITÁVEL ||
|  | ...                                                          ||
|  | [x] Parcela 12 - 30/12/2025   Juros: [R$ 100,00]  ← EDITÁVEL ||
|  +--------------------------------------------------------------+|
|                                                                   |
|  Total de Juros Históricos: R$ 1.200,00                          |
+------------------------------------------------------------------+
```

## Lógica de Cálculo de Datas

A função para calcular datas passadas baseado na frequência:

```typescript
const calculatePastInstallments = (
  startDateStr: string, 
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
): { date: string; index: number }[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = new Date(startDateStr + 'T12:00:00');
  if (isNaN(startDate.getTime()) || startDate >= today) {
    return [];
  }
  
  const installments: { date: string; index: number }[] = [];
  let currentDate = new Date(startDate);
  let index = 0;
  
  // Limitar a 60 parcelas (5 anos mensal, ou ~2 meses diário)
  while (currentDate < today && index < 60) {
    installments.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      index,
    });
    
    // Avançar para próxima parcela
    if (frequency === 'daily') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (frequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (frequency === 'biweekly') {
      currentDate.setDate(currentDate.getDate() + 14);
    } else {
      // monthly
      currentDate = addMonths(currentDate, 1);
    }
    
    index++;
  }
  
  return installments;
};
```

## Fluxo de Uso

### Cenário: Usuário cadastra empréstimo mensal de 1 ano atrás

1. Usuário abre formulário de novo empréstimo
2. Seleciona cliente e digita R$ 1.000 a 10% ao mês
3. Define data início: 30/01/2025 (1 ano atrás)
4. Marca checkbox "Este é um contrato antigo"
5. Sistema calcula automaticamente: 12 parcelas passadas
6. Lista de 12 parcelas aparece, cada uma com juros editável
7. Usuário pode alterar o juros de qualquer parcela individualmente
8. Usuário clica "Selecionar Todas"
9. Resumo mostra total de juros históricos baseado nos valores editados
10. Usuário clica "Criar Empréstimo"

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/HistoricalInterestRecords.tsx` | Reescrever para calcular datas internamente e suportar juros editável |
| `src/pages/Loans.tsx` | Adicionar estado para juros customizados, atualizar props e handleSubmit |

## Estimativa

- **Complexidade**: Média
- **Linhas de código**: ~150
- **Risco**: Baixo (melhoria de funcionalidade existente)

## Testes Recomendados

1. Criar empréstimo mensal com data de 1 ano atrás → deve mostrar 12 parcelas
2. Criar empréstimo diário com data de 30 dias atrás → deve mostrar 30 parcelas
3. Editar o valor de juros de uma parcela → o total deve recalcular
4. Selecionar apenas algumas parcelas → apenas essas devem ser registradas
5. Verificar que os valores editados são salvos corretamente no banco
