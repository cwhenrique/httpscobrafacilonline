

# Plano: Melhorar Filtro de Data no Relatorio de Emprestimos

## Visao Geral
Melhorar a experiencia do filtro de datas na pagina de Relatorio de Emprestimos para:
1. Mostrar instrucoes claras indicando qual data esta sendo selecionada (inicio vs. fim)
2. Alterar o periodo padrao para o mes atual (em vez de 6 meses)

## Situacao Atual vs. Nova

```text
ANTES (atual):
┌─────────────────────────────────────────────────────┐
│ [📅 01/07/25 - 27/01/26]  [Limpar]                 │
│                                                     │
│ (Usuario clica no botao)                           │
│ ┌───────────────────────────┐                      │
│ │        Janeiro 2026       │                      │
│ │  D  S  T  Q  Q  S  S      │                      │
│ │        1  2  3  4  5      │ <-- Sem instrucao    │
│ │  6  7  8  9  ...          │     do que fazer     │
│ └───────────────────────────┘                      │
└─────────────────────────────────────────────────────┘

DEPOIS (proposto):
┌─────────────────────────────────────────────────────┐
│ [📅 01/01/26 - 27/01/26]  [Limpar]                 │
│                           ^                        │
│                   Mes atual como padrao            │
│                                                     │
│ (Usuario clica no botao)                           │
│ ┌───────────────────────────────────────────────┐  │
│ │ ┌─────────────────────────────────────────┐   │  │
│ │ │ Selecione a data inicial               │   │  │
│ │ │                            ou          │   │  │
│ │ │ Selecione a data final                 │   │  │
│ │ │ 01/01/2026 - 15/01/2026               │   │  │
│ │ └─────────────────────────────────────────┘   │  │
│ │        Janeiro 2026       │  Fevereiro 2026   │  │
│ │  D  S  T  Q  Q  S  S      │  D  S  T  Q  ...  │  │
│ │        [1] 2  3  4  5     │        ...        │  │
│ │  6  7  8  9 [10]...       │                   │  │
│ │                                               │  │
│ │            [✓ Confirmar]                      │  │
│ └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Mudancas a Implementar

### 1. Alterar Periodo Padrao para Mes Atual

Modificar o estado inicial de `dateRange` para usar `startOfMonth(new Date())` e `new Date()`:

```typescript
// ANTES
const [dateRange, setDateRange] = useState<DateRange | undefined>({
  from: subMonths(new Date(), 6),  // 6 meses atras
  to: new Date(),
});

// DEPOIS
const [dateRange, setDateRange] = useState<DateRange | undefined>({
  from: startOfMonth(new Date()),  // Inicio do mes atual
  to: new Date(),                  // Hoje
});
```

### 2. Adicionar Instrucoes no Popover do Calendario

Adicionar um cabecalho informativo acima do calendario que mostra:
- "Selecione a data inicial" quando nenhuma data esta selecionada
- "Selecione a data final" quando apenas a data inicial foi selecionada
- "Periodo selecionado" + as datas quando ambas estao selecionadas

### 3. Adicionar Estado Temporario para Selecao

Para mostrar as instrucoes corretamente, adicionar um estado temporario (`tempRange`) que:
- Reseta quando o popover abre (para nova selecao do zero)
- Permite ver o progresso da selecao antes de confirmar
- So aplica ao estado real quando usuario confirma

### 4. Adicionar Botao de Confirmacao

Adicionar um botao "Confirmar" no rodape do popover para aplicar a selecao, similar ao PeriodFilter.tsx.

### 5. Mostrar 2 Meses no Calendario

Alterar `numberOfMonths={1}` para `numberOfMonths={2}` para facilitar selecao de periodos mais longos.

---

## Detalhes Tecnicos

### Novos Imports Necessarios

```typescript
import { startOfMonth } from 'date-fns';
import { Check } from 'lucide-react';
```

### Estados Adicionais

```typescript
const [calendarOpen, setCalendarOpen] = useState(false);
const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(dateRange);
```

### Logica do Popover

```typescript
const handleOpenChange = (open: boolean) => {
  setCalendarOpen(open);
  if (open) {
    // Reset para comecar selecao do zero
    setTempDateRange(undefined);
  }
};

const handleConfirm = () => {
  if (tempDateRange?.from) {
    setDateRange({
      from: tempDateRange.from,
      to: tempDateRange.to || tempDateRange.from,
    });
  }
  setCalendarOpen(false);
};
```

### UI do Cabecalho Informativo

```typescript
<div className="p-3 border-b bg-muted/30">
  <p className="text-sm text-muted-foreground">
    {!tempDateRange?.from 
      ? 'Selecione a data inicial' 
      : !tempDateRange?.to 
        ? 'Selecione a data final' 
        : 'Periodo selecionado'}
  </p>
  {tempDateRange?.from && (
    <p className="text-sm font-medium text-primary mt-1">
      {format(tempDateRange.from, 'dd/MM/yyyy', { locale: ptBR })}
      {tempDateRange.to && ` - ${format(tempDateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`}
    </p>
  )}
</div>
```

### Atualizar Botao "Limpar"

O botao "Limpar" deve resetar para o mes atual (novo padrao):

```typescript
onClick={() => setDateRange({ 
  from: startOfMonth(new Date()), 
  to: new Date() 
})}
```

---

## Arquivo a Ser Modificado

| Arquivo | Acao |
|---------|------|
| `src/pages/ReportsLoans.tsx` | Atualizar periodo padrao, adicionar instrucoes no popover, implementar estado temporario e botao de confirmacao |

---

## Beneficios

1. **Clareza**: Usuario sabe exatamente o que fazer ao selecionar datas
2. **Feedback Visual**: Mostra as datas sendo selecionadas em tempo real
3. **Consistencia**: Mesmo comportamento que o PeriodFilter usado em outras paginas
4. **Padrao Util**: Mes atual e mais relevante para analise diaria do que 6 meses
5. **Experiencia Melhorada**: Calendario maior (2 meses) facilita navegacao

