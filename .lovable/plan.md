
# Corrigir botao "Cobrar via WhatsApp" que nao atualiza apos conexao

## Problema
O `WhatsAppStatusContext` tem uma condicao de corrida: o callback `checkStatus` depende de `profile?.whatsapp_instance_id` no array de dependencias do `useCallback`. Cada vez que o perfil e refetchado (o que acontece varias vezes durante a navegacao), o `checkStatus` e recriado, o efeito re-executa, e durante renders intermediarios (quando profile ainda esta null/loading), o `hasInstance` fica `false` e o estado `isInstanceConnected` e resetado para `false`.

Os logs confirmam isso: ciclos repetidos de "Starting monitoring" / "Stopping monitoring" indicando que o efeito esta re-executando constantemente.

## Solucao
Estabilizar o contexto usando refs para valores que mudam frequentemente, evitando a recriacao constante do callback e do efeito.

## Alteracoes tecnicas

### Arquivo: `src/contexts/WhatsAppStatusContext.tsx`

1. Usar `useRef` para `user.id` e `profile.whatsapp_instance_id` ao inves de coloca-los nas dependencias do `useCallback`
2. Remover `checkStatus` do array de dependencias do `useEffect` principal
3. Nao resetar `isInstanceConnected` para `false` quando `hasInstance` muda temporariamente (apenas quando recebemos uma resposta definitiva da API)
4. Fazer o check inicial apenas uma vez e manter o polling estavel

Mudancas especificas:
- Trocar as dependencias do `useCallback` de `checkStatus` para usar refs (`userIdRef` e `instanceIdRef`) que sao atualizados via `useEffect` separados
- O `useEffect` principal passa a depender apenas de `hasInstance` e `user?.id` (valores estaveis), sem depender de `checkStatus`
- Remover o `setIsInstanceConnected(false)` do branch `!hasInstance` e trocar por um simples `return` (manter o estado anterior ate receber confirmacao da API)

Isso garante que:
- O polling de 2 minutos funcione de forma estavel sem ser interrompido
- O estado `isInstanceConnected` so mude quando a API confirmar conexao/desconexao
- Os botoes atualizem corretamente apos a conexao da instancia
