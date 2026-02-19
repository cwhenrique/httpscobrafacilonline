

# Reestruturar Fluxo de Caixa - Remover Capital Inicial, Mostrar Resultado do Periodo

## Problema atual

O "Capital Inicial" era igual ao total emprestado (R$16.900), que tambem era o valor das saidas. Isso se cancelava e o saldo ficava = entradas, o que nao faz sentido. Na realidade, se saiu R$16.900 e entrou R$12.574, o resultado do periodo e **-R$4.326** (negativo), mas o usuario ainda tem R$7.700 na rua + juros pendentes.

## Nova estrutura do Fluxo de Caixa

```text
+------------------------------------------+
| Caixa Extra (opcional)       R$ 0   [+]  |
|                                          |
| SAIDAS                      -R$ 16.900   |
|   Emprestimos concedidos    -R$ 16.900   |
|   Contas a pagar            -R$ 0        |
|   Custos extras             -R$ 0        |
|                                          |
| ENTRADAS                    +R$ 12.574   |
|   Pagamentos recebidos      +R$ 12.574   |
|     dos quais juros          R$ X.XXX    |
|                                          |
| RESULTADO DO PERIODO        -R$ 4.326    |
|                                          |
| Na Rua: R$7.700  Lucro: R$X  Resultado   |
+------------------------------------------+
```

- **Sem "Capital Inicial" na formula** -- era circular e confuso
- **Resultado do Periodo** = Caixa Extra + Entradas - Saidas
- **Caixa Extra** = dinheiro manual que o usuario tem disponivel mas ainda nao emprestou (opcional, so aparece se > 0 ou ao clicar para adicionar)
- **Na Rua** (rodape) mostra o principal pendente dos emprestimos ativos -- dinheiro que ainda vai voltar

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/ReportsLoans.tsx` | Remover `calculatedInitialBalance`. Simplificar `cashFlowStats`. Passar `initialBalance` como "caixa extra". |
| `src/components/reports/CashFlowCard.tsx` | Remover bloco azul "Capital Inicial" fixo. Adicionar bloco opcional "Caixa Extra". Renomear "Saldo Atual" para "Resultado do Periodo". Ajustar formula. |
| `src/components/reports/CashFlowConfigModal.tsx` | Renomear labels de "Capital Inicial" para "Caixa Extra". |

## Detalhes tecnicos

### 1. `ReportsLoans.tsx` (linhas 748-786)

Remover `calculatedInitialBalance` inteiramente. Simplificar `cashFlowStats`:

```tsx
const cashFlowStats = useMemo(() => ({
  extraCash: initialCashBalance,
  loanedInPeriod: filteredStats.totalLent,
  receivedInPeriod: filteredStats.totalReceived,
  interestReceived: filteredStats.realizedProfit,
}), [initialCashBalance, filteredStats]);
```

Atualizar as props do `CashFlowCard`:
- Remover `calculatedInitialBalance`
- Renomear `initialBalance` para `extraCash`
- Renomear `onUpdateInitialBalance` para `onUpdateExtraCash`

### 2. `CashFlowCard.tsx` - Props e formula

Remover props: `calculatedInitialBalance`.
Renomear: `initialBalance` -> `extraCash`, `onUpdateInitialBalance` -> `onUpdateExtraCash`.

Nova formula:
```tsx
const extraCashValue = extraCash > 0 ? extraCash : 0;
const totalOutflows = loanedInPeriod + billsOutflow + extraCostsTotal;
const totalInflows = receivedInPeriod;
const resultado = extraCashValue + totalInflows - totalOutflows;
```

### 3. `CashFlowCard.tsx` - UI

- **Remover** o bloco azul grande "Capital Inicial" do topo
- **Adicionar** um bloco compacto "Caixa Extra" que so aparece se valor > 0, com botao [+] para adicionar/editar. Fica antes das saidas.
- **Renomear** "Saldo Atual" para "Resultado do Periodo" no bloco grande final
- Manter os 3 cards do rodape (Na Rua, Lucro, Resultado)

### 4. `CashFlowConfigModal.tsx` - Labels

Trocar textos de "Capital Inicial" para "Caixa Extra" e ajustar descricao para "Dinheiro disponivel que ainda nao foi emprestado".

