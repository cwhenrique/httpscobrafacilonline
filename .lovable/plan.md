

# Plano: Corrigir Loop de Verificações e Persistência de Conexão WhatsApp

## Problema Identificado

Analisando os logs de rede, identifico **dois problemas críticos**:

### 1. Excesso de Chamadas Duplicadas
O sistema está fazendo **mais de 20 chamadas** ao `whatsapp-check-status` em apenas 10 segundos! Isso acontece porque:
- O hook `useWhatsAppAutoReconnect` dispara ao montar
- A verificação inicial em `checkWhatsAppStatus` também dispara
- O `useEffect` pode estar sendo re-executado devido a mudanças de dependências
- Pode haver múltiplas instâncias do hook sendo criadas

### 2. Estado "connecting" Persistente
A instância está presa em `status: "connecting"` mesmo após o QR ser escaneado, o que indica que:
- A Evolution API não está recebendo a confirmação de conexão
- Ou a sessão não está sendo salva corretamente no servidor

## Solução

### Etapa 1: Remover Verificação Duplicada

O problema está em ter **duas fontes de verificação** competindo:
1. `checkWhatsAppStatus()` no `useEffect` inicial
2. `useWhatsAppAutoReconnect` que também faz uma verificação imediata

Precisamos unificar para ter apenas UMA fonte de verdade.

### Etapa 2: Simplificar o Hook Auto-Reconnect

Remover a verificação imediata do hook e deixar apenas o intervalo de 2 minutos.

### Etapa 3: Adicionar Debounce/Throttle

Garantir que apenas uma verificação aconteça por vez, independente de quantos re-renders ocorram.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useWhatsAppAutoReconnect.ts` | Remover verificação imediata, apenas intervalo de 2 min |
| `src/pages/Profile.tsx` | Simplificar verificação inicial, evitar duplicação |

## Mudanças Específicas

### useWhatsAppAutoReconnect.ts

Remover a linha 148 que faz a verificação imediata:
```typescript
// REMOVER:
// checkAndReconnect();

// Apenas configurar o intervalo de 2 minutos
intervalRef.current = setInterval(checkAndReconnect, intervalMs);
```

### Profile.tsx

Manter apenas a verificação inicial que já existe:
```typescript
useEffect(() => {
  if (user) {
    fetchStats();
    checkWhatsAppStatus(false); // Verificação passiva
  }
}, [user]);
```

E garantir que o hook `useWhatsAppAutoReconnect` só inicie o intervalo, sem verificação imediata.

## Fluxo Corrigido

```text
[Página carrega]
         ↓
[checkWhatsAppStatus(false)] ← Uma única verificação passiva
         ↓
[UI mostra status atual]
         ↓
[A cada 2 min: useWhatsAppAutoReconnect]
         ↓
[Se desconectado → tenta reconectar]
         ↓
[Se conectado → atualiza UI]
```

## Benefícios

1. **Sem chamadas duplicadas**: Apenas uma verificação inicial
2. **Menos carga no servidor**: Verificações espaçadas de 2 minutos
3. **Conexão estável**: Sem interferência de múltiplas tentativas simultâneas
4. **UX melhorada**: Usuário não vê estado inconsistente

