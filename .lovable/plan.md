
# Plano: Calcular Saldo Inicial Automático para Fluxo de Caixa

## Entendimento da Lógica

Quando o usuário **não configurou manualmente** um saldo inicial, o sistema deve calcular um valor padrão baseado no histórico de operações:

**Fórmula:**
```
Saldo Implícito = Total Recebido (histórico) - Capital na Rua (atual)
```

**Exemplo prático:**
- Usuário emprestou R$ 100.000 ao longo do tempo
- Recebeu de volta R$ 80.000
- Atualmente tem R$ 50.000 ainda na rua (empréstimos ativos)
- O que ele "não voltou a emprestar": R$ 80.000 - R$ 50.000 = **R$ 30.000 em caixa**

Ou seja, a diferença entre o que ele recebeu e o que ele recolocou na rua representa o dinheiro que ficou "parado" no caixa.

---

## Alterações Necessárias

### 1. Modificar CashFlowCard.tsx

Adicionar prop `calculatedInitialBalance` para receber o valor calculado automaticamente:

```typescript
interface CashFlowCardProps {
  initialBalance: number;           // Valor configurado manualmente
  calculatedInitialBalance: number; // NOVO: Valor calculado automaticamente
  loanedInPeriod: number;
  totalOnStreet: number;
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
  isUnlocked: boolean;
}
```

Usar o valor calculado como fallback quando não há valor manual:

```typescript
// Usar valor manual se configurado, senão usar valor calculado
const effectiveInitialBalance = initialBalance > 0 
  ? initialBalance 
  : calculatedInitialBalance;

const currentBalance = effectiveInitialBalance - loanedInPeriod + receivedInPeriod;
```

**Remover estado bloqueado** - o card sempre mostra dados, mesmo sem configuração manual.

### 2. Modificar ReportsLoans.tsx

Calcular o saldo inicial implícito:

```typescript
// Cálculo do saldo implícito
const calculatedInitialBalance = useMemo(() => {
  // Total recebido de TODOS os empréstimos (histórico completo)
  const totalReceivedAllTime = stats.allLoans.reduce((sum, loan) => 
    sum + Number(loan.total_paid || 0), 0);
  
  // Capital atualmente na rua
  const currentCapitalOnStreet = stats.totalOnStreet;
  
  // Saldo implícito = O que recebeu - O que está na rua
  // Representa o dinheiro que "sobrou" e não foi reemprestado
  return Math.max(0, totalReceivedAllTime - currentCapitalOnStreet);
}, [stats]);
```

Passar para o CashFlowCard:

```typescript
<CashFlowCard
  initialBalance={cashFlowStats.initialBalance}
  calculatedInitialBalance={calculatedInitialBalance}
  loanedInPeriod={cashFlowStats.loanedInPeriod}
  totalOnStreet={filteredStats.totalOnStreet}
  receivedInPeriod={cashFlowStats.receivedInPeriod}
  interestReceived={cashFlowStats.interestReceived}
  onUpdateInitialBalance={handleUpdateCashFlowBalance}
  isUnlocked={true}  // Sempre desbloqueado agora
/>
```

### 3. Modificar CashFlowConfigModal.tsx

Mostrar o valor calculado como sugestão para o usuário:

```typescript
interface CashFlowConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  suggestedBalance?: number;  // NOVO: Valor sugerido pelo sistema
  onSave: (value: number) => void;
}
```

Adicionar botão "Usar valor sugerido":

```typescript
{suggestedBalance && suggestedBalance > 0 && (
  <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
    <p className="text-sm text-blue-500 font-medium">💡 Sugestão do sistema:</p>
    <p className="text-lg font-bold text-blue-500">{formatCurrency(suggestedBalance)}</p>
    <p className="text-xs text-muted-foreground mt-1">
      Baseado no seu histórico de operações
    </p>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => setValue((suggestedBalance * 100).toString())}
      className="mt-2 text-xs border-blue-500/30 text-blue-500"
    >
      Usar este valor
    </Button>
  </div>
)}
```

---

## Fluxo Visual

```text
USUÁRIO NOVO (sem saldo configurado)
┌─────────────────────────────────────────────────────────┐
│  Sistema calcula automaticamente:                        │
│  - Total Recebido: R$ 80.000                            │
│  - Capital na Rua: R$ 50.000                            │
│  - Saldo Implícito: R$ 30.000                           │
│  ↓                                                       │
│  CashFlowCard mostra:                                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Inicial: R$ 30.000 (calculado)                    │  │
│  │ → Saídas → Entradas                               │  │
│  │ Saldo Atual: R$ X                                 │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  Se usuário clica para editar:                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 💡 Sugestão do sistema: R$ 30.000                 │  │
│  │ [Usar este valor]                                 │  │
│  │                                                   │  │
│  │ Ou digite seu próprio valor: [________]           │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/reports/CashFlowCard.tsx` | Adicionar `calculatedInitialBalance` prop, remover estado bloqueado, usar valor calculado como fallback |
| `src/components/reports/CashFlowConfigModal.tsx` | Adicionar `suggestedBalance` prop e botão "Usar este valor" |
| `src/pages/ReportsLoans.tsx` | Calcular `calculatedInitialBalance` e passar para os componentes |

---

## Resultado Final

| Cenário | Comportamento |
|---------|---------------|
| Usuário novo sem histórico | Mostra R$ 0,00 como inicial |
| Usuário com histórico, sem config manual | Calcula automaticamente baseado em (Recebido - Na Rua) |
| Usuário com config manual | Usa o valor configurado manualmente |
| Usuário edita o saldo | Modal mostra sugestão + permite valor personalizado |
