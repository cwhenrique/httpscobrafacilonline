

## Diagnóstico: Atualizações não chegam aos usuários

### Causa raiz

O problema é a configuração do **Service Worker (PWA)** que **bloqueia atualizações** para os usuários finais. Existem 3 problemas combinados:

#### 1. `skipWaiting: false` + `clientsClaim: false` (vite.config.ts)
O novo Service Worker fica **esperando** até que o usuário feche TODAS as abas do app. Se o usuário usa como PWA instalada, ele nunca fecha completamente — apenas minimiza. O SW antigo continua servindo arquivos velhos indefinidamente.

#### 2. `onNeedRefresh` bloqueado por `pwa_session_active` (main.tsx)
Quando o SW detecta uma atualização, o código verifica `sessionStorage.pwa_session_active`. Como o `useVisibilityControl` **sempre** seta isso como `true` ao montar o componente, a atualização **nunca é aplicada** enquanto o app está aberto. O usuário fica preso na versão antiga.

#### 3. `sessionStorage` não limpa em PWA standalone
O `beforeunload` deveria limpar `pwa_session_active`, mas em PWAs standalone (display: standalone), o evento `beforeunload` **não dispara de forma confiável** quando o usuário desliza o app para fechar. Resultado: `pwa_session_active` permanece `true` mesmo após fechar e reabrir.

### Solução

#### 1. Ativar `skipWaiting: true` e `clientsClaim: true` no Workbox
O novo SW assume controle imediato sem esperar fechamento de abas.

#### 2. Simplificar `onNeedRefresh` — aplicar atualização automaticamente
Remover a verificação de `pwa_session_active` e aplicar a atualização diretamente (recarregar a página). Para não interromper o usuário no meio de algo, fazer reload apenas quando o app voltar de background (visibility change).

#### 3. Adicionar verificação periódica de atualizações
Checar por SW updates a cada 5 minutos para garantir que mesmo usuários que nunca fecham o app recebam atualizações.

### Alterações

#### `vite.config.ts` — Ativar skipWaiting e clientsClaim
```typescript
workbox: {
  skipWaiting: true,    // era false
  clientsClaim: true,   // era false
  // ... resto igual
}
```

#### `src/main.tsx` — Aplicar updates automaticamente
```typescript
const updateSW = registerSW({
  onNeedRefresh() {
    // Aplicar atualização imediatamente — o skipWaiting já garante
    // que o novo SW assume controle
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  },
});

// Verificar atualizações a cada 5 minutos
setInterval(() => {
  updateSW();
}, 5 * 60 * 1000);
```

#### `src/hooks/useVisibilityControl.ts` — Forçar reload no retorno se há update pendente
Ao voltar de background, verificar se o SW mudou e forçar reload para carregar a versão nova. Remover dependência de `pwa_session_active` para atualizações.

