
# Plano: Corrigir Persistência de Conexão WhatsApp

## Problema Identificado

Ao analisar os logs da Evolution API, identifico que as instâncias do WhatsApp estão perdendo a conexão quando o usuário sai ou recarrega a página. Os logs mostram:

```
Instance state: close, isConnected: false
Attempting to restart instance: cf_f83121f6_mlb0dqqy
State after restart: connecting
```

Isso indica que a conexão não está sendo mantida como deveria. O problema ocorre porque:

1. **A verificação inicial tenta reconectar agressivamente** - Ao carregar a página, o sistema verifica o status e, se estiver desconectado, tenta reconectar imediatamente, o que gera um novo QR Code
2. **O hook `useWhatsAppAutoReconnect` chama com `attemptReconnect: true`** mesmo na primeira verificação, o que pode causar loops de reconexão
3. **A instância pode ter sido deslogada do lado do WhatsApp** (por exemplo, se o usuário deslogou do celular ou a sessão expirou)

## Solução Proposta

### 1. Melhorar a Verificação Inicial (sem tentativa de reconexão automática)

Modificar `checkWhatsAppStatus` para que a **primeira verificação ao carregar a página seja apenas de leitura**, sem tentar reconectar. Só tentará reconectar após comando explícito do usuário ou pelo monitoramento em background.

### 2. Separar Verificação de Status vs Reconexão

- **Verificação passiva**: Apenas lê o estado atual da Evolution API sem modificar nada
- **Reconexão ativa**: Tenta restart/connect, mas apenas quando solicitado explicitamente

### 3. Adicionar Proteção contra Loops de Reconexão

Se a instância falhar em reconectar 3 vezes seguidas, parar de tentar e notificar o usuário que precisa escanear o QR Code novamente.

### 4. Melhorar a Lógica do Hook Auto-Reconnect

O hook `useWhatsAppAutoReconnect` deve:
- Não tentar reconectar se acabou de verificar e está desconectado
- Esperar pelo menos 1 minuto após uma falha antes de tentar novamente
- Limitar tentativas consecutivas de reconexão

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Profile.tsx` | Primeira verificação sem `attemptReconnect` |
| `src/hooks/useWhatsAppAutoReconnect.ts` | Adicionar controle de tentativas e backoff |
| `supabase/functions/whatsapp-check-status/index.ts` | Separar lógica de verificação vs reconexão, não fazer restart se não solicitado |

## Detalhamento Técnico

### Profile.tsx - Verificação Inicial Passiva

```typescript
useEffect(() => {
  if (user) {
    fetchStats();
    // ✅ Primeira verificação SEM tentar reconectar
    checkWhatsAppStatus(false); 
  }
}, [user]);
```

### useWhatsAppAutoReconnect.ts - Controle de Tentativas

```typescript
const consecutiveFailuresRef = useRef(0);
const MAX_CONSECUTIVE_FAILURES = 3;

const checkAndReconnect = useCallback(async () => {
  // Se já falhou muitas vezes, não tenta mais
  if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
    console.log('[Auto-Reconnect] Max failures reached, stopping');
    return;
  }
  
  // ... verificação existente ...
  
  if (!status?.connected) {
    consecutiveFailuresRef.current++;
  } else {
    consecutiveFailuresRef.current = 0;
  }
}, [...]);
```

### whatsapp-check-status - Modo Somente Leitura

```typescript
// Se attemptReconnect=false, apenas retorna o status sem tentar modificar
if (!attemptReconnect) {
  return new Response(JSON.stringify({ 
    connected: isConnected,
    status: state,
    instanceName,
    phoneNumber,
    // Indica que pode tentar reconectar manualmente
    canAttemptReconnect: !isConnected && (state === 'close' || state === 'disconnected'),
  }), {...});
}
```

## Fluxo Corrigido

```
[Usuário abre página de Perfil]
         ↓
[checkWhatsAppStatus(false)] ← Apenas lê status
         ↓
    ┌────┴────┐
    │         │
  OPEN      CLOSE/DISCONNECTED
    │         │
  ✅ OK    UI mostra "Reconectar"
            ou "Gerar QR Code"
         ↓
[A cada 2 min: useWhatsAppAutoReconnect]
         ↓
[Se desconectado E < 3 falhas → tenta reconectar]
         ↓
[Se >= 3 falhas → para e mostra aviso]
```

## Benefícios

1. **Sem loops de reconexão**: Limita tentativas automáticas
2. **Experiência melhor**: Usuário não vê QR Code aleatório ao abrir página
3. **Economia de recursos**: Menos chamadas desnecessárias à Evolution API
4. **Diagnóstico claro**: Se a conexão não persiste, o usuário sabe que precisa agir

