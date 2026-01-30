

# Plano: Atualização Automática do Calendário de Cobranças

## Problema Identificado

O Calendário de Cobranças está exibindo dados incorretos de empréstimos em atraso porque:

1. **Cache de 5 minutos**: Os dados do `useLoans` ficam em cache por até 5 minutos
2. **Dados desatualizados**: Quando um pagamento é registrado, o cache pode não refletir imediatamente
3. **Sem atualização automática**: O calendário não atualiza os dados periodicamente

## Solução: Atualização Automática em Background

### Parte 1: Reduzir Cache e Adicionar Polling Automático

**Arquivo:** `src/hooks/useLoans.ts`

| Configuração | Antes | Depois |
|--------------|-------|--------|
| staleTime | 5 minutos | 30 segundos |
| refetchInterval | Não existia | 60 segundos |

Isso fará com que:
- Os dados sejam considerados "frescos" por apenas 30 segundos
- A cada 60 segundos, o sistema busca dados novos automaticamente em background

### Parte 2: Forçar Atualização ao Abrir o Calendário

**Arquivo:** `src/pages/CalendarView.tsx`

Adicionar um `useEffect` que força a busca de dados frescos sempre que o usuário navegar para o calendário:

```typescript
useEffect(() => {
  refetch();
}, []);
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| src/hooks/useLoans.ts | Reduzir staleTime para 30s, adicionar refetchInterval de 60s |
| src/pages/CalendarView.tsx | Adicionar refetch automático ao montar componente |

## Fluxo de Atualização

```text
Usuário abre Calendário
       ↓
Refetch imediato (dados mais recentes)
       ↓
A cada 60 segundos → Atualização automática silenciosa
       ↓
Se sair e voltar → Refetch novamente
```

## Resultado Esperado

- O calendário sempre mostrará dados atualizados
- Atualizações acontecem automaticamente em background sem intervenção do usuário
- Ao navegar para o calendário, os dados são sempre recarregados

