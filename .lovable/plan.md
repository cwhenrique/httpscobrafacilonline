

# Desbloquear Fluxo de Caixa - Estado Inicial Bloqueado

## Problema

Usuários que ja usam o sistema terão o Fluxo de Caixa zerado porque nunca configuraram o saldo inicial. Isso pode causar confusão, pois os valores calculados (Saídas, Entradas, Saldo Atual) nao fazem sentido sem um ponto de partida definido.

## Solucao

Criar dois estados para o CashFlowCard:
1. **Bloqueado**: Quando `cash_flow_initial_balance` for `null` ou `0`
2. **Desbloqueado**: Quando o usuario definir o saldo inicial

### Estado Bloqueado (Novo)

Exibir uma tela motivacional que explica o recurso e convida o usuario a configurar:

```text
+--------------------------------------------------+
|  Wallet  Fluxo de Caixa                         |
|--------------------------------------------------|
|                                                  |
|     [Icone grande de cadeado/cofre]              |
|                                                  |
|     Desbloqueie o Fluxo de Caixa                |
|                                                  |
|     Configure seu saldo inicial e acompanhe     |
|     em tempo real: entradas, saidas, lucro e    |
|     capital na rua.                             |
|                                                  |
|     [ Desbloquear Agora ]  (botao verde)        |
|                                                  |
+--------------------------------------------------+
```

### Estado Desbloqueado (Atual)

Manter o layout atual com todas as metricas visiveis.

## Alteracoes Tecnicas

### Arquivo: `src/components/reports/CashFlowCard.tsx`

1. Adicionar nova prop `isUnlocked` (boolean)
2. Criar estado visual "bloqueado" com:
   - Icone grande (Lock ou PiggyBank estilizado)
   - Titulo "Desbloqueie o Fluxo de Caixa"
   - Texto explicativo
   - Botao "Desbloquear Agora" que abre o modal

```typescript
interface CashFlowCardProps {
  initialBalance: number;
  loanedInPeriod: number;
  totalOnStreet: number;
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
  isUnlocked: boolean; // Nova prop
}
```

3. Logica de renderizacao:

```typescript
// Se NAO esta desbloqueado, mostra tela de bloqueio
if (!isUnlocked) {
  return (
    <Card>
      {/* Estado bloqueado - tela de onboarding */}
      <div className="py-8 text-center">
        <Lock className="w-12 h-12 mx-auto text-primary/50 mb-4" />
        <h3>Desbloqueie o Fluxo de Caixa</h3>
        <p>Configure seu saldo inicial...</p>
        <Button onClick={() => setConfigOpen(true)}>
          Desbloquear Agora
        </Button>
      </div>
    </Card>
  );
}

// Estado normal desbloqueado (codigo atual)
return (
  <Card>
    {/* Layout completo atual */}
  </Card>
);
```

### Arquivo: `src/pages/ReportsLoans.tsx`

1. Calcular se o fluxo esta desbloqueado:

```typescript
// O fluxo esta desbloqueado se o usuario ja definiu um saldo inicial
const isCashFlowUnlocked = profile?.cash_flow_initial_balance !== null 
                         && profile?.cash_flow_initial_balance !== undefined
                         && profile.cash_flow_initial_balance > 0;
```

2. Passar a prop para o componente:

```typescript
<CashFlowCard
  initialBalance={cashFlowStats.initialBalance}
  loanedInPeriod={cashFlowStats.loanedInPeriod}
  totalOnStreet={filteredStats.totalOnStreet}
  receivedInPeriod={cashFlowStats.receivedInPeriod}
  interestReceived={cashFlowStats.interestReceived}
  onUpdateInitialBalance={handleUpdateCashFlowBalance}
  isUnlocked={isCashFlowUnlocked} // Nova prop
/>
```

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/reports/CashFlowCard.tsx` | Adicionar estado "bloqueado" com tela de onboarding |
| `src/pages/ReportsLoans.tsx` | Passar prop `isUnlocked` baseada no perfil |

## Resultado Esperado

1. **Usuarios novos/existentes sem configuracao**: Verao a tela de "Desbloquear" com call-to-action claro
2. **Apos configurar saldo inicial**: O card muda automaticamente para exibir todas as metricas
3. **Sem confusao**: Usuarios nao verao valores zerados/incorretos sem contexto

## Beneficios

- Evita confusao para usuarios existentes
- Cria experiencia de onboarding clara
- Mantem consistencia - valores so aparecem quando fazem sentido
- Usuario tem controle sobre quando ativar o recurso

