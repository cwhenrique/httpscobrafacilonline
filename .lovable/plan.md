
# Plano: Melhorar UX ao Zerar Saldo Inicial do Fluxo de Caixa

## Situação Atual

A lógica já está implementada corretamente:
- Quando `cash_flow_initial_balance` é `0` ou `null`, o sistema usa o `calculatedInitialBalance` (capital na rua puro)
- O código em `CashFlowCard.tsx` linha 32-34: `initialBalance > 0 ? initialBalance : calculatedInitialBalance`

**O que precisa melhorar:** A experiência do usuário ao resetar para o valor automático.

## Alterações Propostas

### 1. Adicionar botão "Resetar" no Modal (CashFlowConfigModal.tsx)

Adicionar um botão claro para resetar o valor para automático, junto com uma explicação:

```text
┌─────────────────────────────────────────────────────────┐
│  📊 Sugestão do sistema: R$ 37.000                      │
│  Baseado no capital na rua                              │
│  [Usar este valor]                                      │
├─────────────────────────────────────────────────────────┤
│  Saldo Inicial do Caixa                                 │
│  ┌─────────────────────────────┐                        │
│  │ R$ ___________________      │                        │
│  └─────────────────────────────┘                        │
│  ⚠️ Deixe vazio para usar o valor automático            │
│                                                         │
│  [Resetar para automático] ← NOVO BOTÃO                 │
├─────────────────────────────────────────────────────────┤
│              [Cancelar]    [Salvar]                     │
└─────────────────────────────────────────────────────────┘
```

### 2. Mostrar mensagem quando campo vazio

Adicionar indicador visual quando o usuário limpar o campo:

- Se o campo estiver vazio, mostrar: "O sistema usará automaticamente o capital na rua (R$ X.XXX)"

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/reports/CashFlowConfigModal.tsx` | Adicionar botão "Resetar para automático" e mensagem quando campo vazio |

### Código das Alterações

**CashFlowConfigModal.tsx:**

1. Adicionar botão "Resetar para automático":
```tsx
const handleReset = () => {
  setValue('');
};
```

2. Mostrar mensagem dinâmica quando campo vazio:
```tsx
{!value && suggestedBalance && suggestedBalance > 0 && (
  <p className="text-xs text-emerald-500 flex items-center gap-1">
    <Info className="w-3 h-3" />
    Será usado automaticamente: {formatCurrency(suggestedBalance)}
  </p>
)}
```

3. Adicionar botão de reset no footer:
```tsx
<Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
  Resetar para automático
</Button>
```

## Resultado Esperado

- Usuário entende claramente que ao deixar vazio ou zerar, o sistema usará o capital na rua
- Botão dedicado para resetar facilita a ação
- Mensagem confirma qual valor será usado quando o campo estiver vazio
