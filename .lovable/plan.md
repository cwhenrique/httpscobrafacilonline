

# Mostrar Saídas do Período e Capital na Rua Total no Card de Fluxo de Caixa

## Resumo

Modificar o card de Fluxo de Caixa para exibir **duas métricas** no lugar de apenas "Saídas":
1. **Saídas no Período**: Total emprestado dentro do filtro de datas selecionado
2. **Capital na Rua**: Total de principal pendente de TODOS os empréstimos ativos (independente do período)

## Layout Proposto

```text
+------------------------------------------------------------------+
| 💰 Fluxo de Caixa                                    [Configurar] |
+------------------------------------------------------------------+
|                                                                   |
| ┌─────────────┐  ┌──────────────────┐  ┌─────────────┐  ┌───────┐ |
| │ 💵 Inicial  │  │ 📤 Saídas        │  │ 📥 Entradas │  │ 💰    │ |
| │ R$ 20.000   │  │ R$ 5.580         │  │ R$ 8.500    │  │ Atual │ |
| │             │  │ no período       │  │ recebido    │  │R$     │ |
| │             │  ├──────────────────┤  │             │  │ 22.920│ |
| │             │  │ 📊 Na Rua: 13.3k │  │             │  │       │ |
| └─────────────┘  └──────────────────┘  └─────────────┘  └───────┘ |
|                                                                   |
| ┌─────────────────────────────────────────────────────────────┐  |
| │ 📈 Lucro no Período: R$ 2.000,00 (juros recebidos)          │  |
| └─────────────────────────────────────────────────────────────┘  |
+------------------------------------------------------------------+
```

## Alterações Necessárias

### 1. Atualizar interface do CashFlowCard

**Arquivo:** `src/components/reports/CashFlowCard.tsx`

Adicionar nova prop `totalOnStreet`:

```typescript
interface CashFlowCardProps {
  initialBalance: number;
  loanedInPeriod: number;      // Saídas no período
  totalOnStreet: number;        // NOVO: Capital na rua total
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
}
```

### 2. Modificar a célula "Saídas" para mostrar ambos

Alterar a célula de "Saídas" para incluir:
- **Valor principal**: Emprestado no período (em vermelho)
- **Subtexto**: "no período"
- **Linha adicional**: "Na Rua: R$ X" (capital na rua total, cor neutra/azul)

Estrutura visual:

```jsx
<div className="bg-muted/50 rounded-lg p-3 text-center">
  {/* Título */}
  <div className="flex items-center justify-center gap-1.5 mb-1">
    <ArrowUpRight className="w-4 h-4 text-red-500" />
    <span className="text-xs text-muted-foreground font-medium">Saídas</span>
  </div>
  
  {/* Valor do período */}
  <p className="text-sm sm:text-base font-bold text-red-500">
    -{formatCurrency(loanedInPeriod)}
  </p>
  <p className="text-[10px] text-muted-foreground">no período</p>
  
  {/* Separador visual */}
  <div className="border-t border-muted my-2" />
  
  {/* Capital na Rua Total */}
  <div className="flex items-center justify-center gap-1">
    <Briefcase className="w-3 h-3 text-orange-500" />
    <span className="text-[10px] text-orange-500 font-medium">Na Rua:</span>
  </div>
  <p className="text-xs font-semibold text-orange-500">
    {formatCurrency(totalOnStreet)}
  </p>
</div>
```

### 3. Passar a prop no ReportsLoans

**Arquivo:** `src/pages/ReportsLoans.tsx`

Atualizar a chamada do CashFlowCard para incluir `totalOnStreet`:

```jsx
<CashFlowCard
  initialBalance={cashFlowStats.initialBalance}
  loanedInPeriod={cashFlowStats.loanedInPeriod}
  totalOnStreet={filteredStats.totalOnStreet}  // NOVO
  receivedInPeriod={cashFlowStats.receivedInPeriod}
  interestReceived={cashFlowStats.interestReceived}
  onUpdateInitialBalance={handleUpdateCashFlowBalance}
/>
```

## Detalhes Técnicos

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/reports/CashFlowCard.tsx` | Adicionar prop `totalOnStreet`, modificar célula de Saídas |
| `src/pages/ReportsLoans.tsx` | Passar `filteredStats.totalOnStreet` para o componente |

### Valores a Exibir

| Métrica | Origem | Descrição |
|---------|--------|-----------|
| Saídas (período) | `filteredStats.totalLent` | Principal emprestado no período filtrado |
| Capital na Rua | `filteredStats.totalOnStreet` | Principal pendente de TODOS empréstimos ativos |
| Entradas | `filteredStats.totalReceived` | Pagamentos recebidos no período |
| Caixa Atual | Cálculo | Inicial - Saídas do período + Entradas |

### Cores

- **Saídas no período**: Vermelho (R$ -5.580)
- **Capital na Rua**: Laranja (R$ 13.331,65)
- **Entradas**: Verde
- **Caixa Atual**: Verde se positivo, vermelho se negativo

## Benefícios

1. **Visão completa**: Usuário vê tanto o fluxo do período quanto a posição total
2. **Contexto**: Entende que R$ 5.580 saíram no período, mas R$ 13.331 ainda estão emprestados no total
3. **Sem confusão**: Valores claramente rotulados ("no período" vs "Na Rua")
4. **Compacto**: Tudo no mesmo card, sem ocupar espaço extra

