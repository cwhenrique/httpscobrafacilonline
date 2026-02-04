

# Plano: Garantir Atualização dos Dados do Dashboard ao Reabrir o App

## Problema Identificado

Os dados do Dashboard (número de clientes, empréstimos, etc.) **não atualizam** quando o usuário fecha e reabre o app (PWA). Isso acontece por:

1. **QueryClient global** configurado com `refetchOnWindowFocus: false` (linha 45 do App.tsx)
2. **staleTime de 5 minutos** no nível global mantém cache por muito tempo
3. O hook `useVisibilityControl` não invalida o cache ao retornar ao app
4. Mesmo que hooks individuais tentem `refetchOnWindowFocus: true`, a config global tem precedência parcial

## Solução

### 1. Atualizar QueryClient Global (`src/App.tsx`)

Alterar a configuração do QueryClient para permitir refetch ao focar a janela:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,   // ← Habilitar refetch ao voltar
      refetchOnReconnect: true,     // ← Habilitar refetch ao reconectar
      staleTime: 1000 * 30,         // ← Reduzir para 30 segundos
    },
  },
});
```

### 2. Aprimorar `useVisibilityControl` (`src/hooks/useVisibilityControl.ts`)

Adicionar invalidação do cache quando o app volta a ficar visível:

```typescript
import { useQueryClient } from '@tanstack/react-query';

export function useVisibilityControl() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Voltou ao app - invalidar queries principais para buscar dados frescos
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['operational-stats'] });
        queryClient.invalidateQueries({ queryKey: ['loans'] });
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      }
    };
    // ...resto do código
  }, [queryClient]);
}
```

### 3. Mover `useVisibilityControl` para Dentro do Provider

Como `useVisibilityControl` usará `useQueryClient`, ele precisa estar **dentro** do `QueryClientProvider`. Criar um componente wrapper:

```typescript
// src/components/AppProviders.tsx ou inline no App.tsx
const AppContent = () => {
  useVisibilityControl();
  useDevToolsProtection();
  
  return (
    <AuthProvider>
      <EmployeeProvider>
        {/* ... resto do app */}
      </EmployeeProvider>
    </AuthProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Atualizar QueryClient config e reestruturar hooks |
| `src/hooks/useVisibilityControl.ts` | Adicionar invalidação de cache ao voltar |

## Comportamento Esperado

| Ação do Usuário | Antes | Depois |
|-----------------|-------|--------|
| Fechar e reabrir app | Dados antigos em cache | Busca novos dados do banco |
| Minimizar e voltar | Dados antigos | Busca novos dados |
| Navegar para outra aba e voltar | Dados antigos | Busca novos dados |
| Reconectar internet | Dados antigos | Busca novos dados |

## Impacto

- Dashboard sempre mostrará dados atualizados
- Número de clientes, empréstimos e valores financeiros serão precisos
- Pequeno aumento de requisições ao banco (aceitável para garantir dados frescos)

## Seção Técnica

### Alteração Completa em `src/hooks/useVisibilityControl.ts`

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useVisibilityControl() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    sessionStorage.setItem('pwa_session_active', 'true');
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sessionStorage.setItem('pwa_session_active', 'true');
        
        // Verificar quanto tempo ficou oculto
        const lastHidden = sessionStorage.getItem('pwa_last_hidden');
        const hiddenDuration = lastHidden ? Date.now() - parseInt(lastHidden) : 0;
        
        // Se ficou oculto por mais de 30 segundos, invalidar cache
        if (hiddenDuration > 30000) {
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['operational-stats'] });
          queryClient.invalidateQueries({ queryKey: ['loans'] });
          queryClient.invalidateQueries({ queryKey: ['clients'] });
        }
      } else {
        sessionStorage.setItem('pwa_last_hidden', Date.now().toString());
      }
    };
    
    // ... resto do código existente
  }, [queryClient]);
}
```

### Alteração em `src/App.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 1000 * 30, // 30 segundos
    },
  },
});

// Componente interno que usa hooks que dependem dos providers
const AppContent = () => {
  useVisibilityControl();
  useDevToolsProtection();
  
  return (
    <AuthProvider>
      <EmployeeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AccessDebugPanel />
            <Routes>
              {/* ... todas as rotas */}
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </EmployeeProvider>
    </AuthProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);
```

