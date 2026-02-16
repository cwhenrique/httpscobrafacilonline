
# Correcao: Dois Botoes de Cobranca Sempre Visiveis

## Problema Atual

Cada componente de cobranca (SendOverdueNotification, SendDueTodayNotification, SendEarlyNotification) exibe apenas **um botao** que alterna entre:
- "Cobrar via WhatsApp" (link wa.me) quando a instancia esta desconectada
- "Enviar Cobranca" (via API) quando conectada

O problema e que o sistema de verificacao de conexao (polling a cada 2 minutos) pode estar desatualizado, fazendo o botao de "Enviar Cobranca" aparecer quando a instancia ja esta offline. Ao clicar, o usuario recebe um erro generico da edge function.

## Solucao

Mostrar **sempre os 2 botoes** em todos os componentes de cobranca:

1. **"Cobrar via WhatsApp"** (link wa.me) - sempre ativo se o cliente tiver telefone com DDD
2. **"Enviar Cobranca"** (via instancia API) - visualmente desativado quando a instancia nao esta conectada

Se o usuario clicar no botao de instancia estando desconectado, em vez de erro, mostrar um toast informativo orientando a conectar via QR Code ou usar o outro botao.

## Componentes a Modificar

| Arquivo | Descricao |
|---|---|
| `SendOverdueNotification.tsx` | Dois botoes: "Cobrar via WhatsApp" + "Enviar Cobranca" |
| `SendDueTodayNotification.tsx` | Dois botoes: "Cobrar via WhatsApp" + "Cobrar Parcela de Hoje" |
| `SendEarlyNotification.tsx` | Dois botoes: "Cobrar via WhatsApp" + "Cobrar Antes do Prazo" |

## Detalhes Tecnicos

### Logica dos Botoes

Para cada componente, adicionar uma variavel `hasInstance` que verifica se o usuario **configurou** uma instancia (independente de estar conectada):

```text
const hasInstance = !!(
  profile?.whatsapp_instance_id &&
  profile?.whatsapp_connected_phone &&
  profile?.whatsapp_to_clients_enabled
);
```

Os dois botoes ficam lado a lado:

```text
Botao 1 - "Cobrar via WhatsApp" (link wa.me)
  - Sempre visivel se clientPhone existe
  - onClick: abre MessagePreviewDialog com mode='whatsapp_link'

Botao 2 - "Enviar Cobranca" (instancia API)
  - Visivel apenas se hasInstance = true (usuario configurou instancia)
  - Se isInstanceConnected = false: aparece com opacity reduzida e cursor not-allowed
  - onClick quando desconectado: toast.info("Sua instancia WhatsApp nao esta conectada. Conecte via QR Code em Configuracoes, ou use 'Cobrar via WhatsApp'.")
  - onClick quando conectado: fluxo normal (SpamWarning -> Preview -> Enviar)
```

### Mudanca no catch de erros

Nos 3 componentes, ao detectar erro de conexao no envio:
- Chamar `markDisconnected()` 
- **Nao fechar** o dialogo (`setShowPreview(false)` sera removido do catch de conexao)
- Mostrar toast informativo
- O `previewMode` mudara automaticamente para `whatsapp_link` pois `canSendViaAPI` sera recalculado

### Estrutura visual dos botoes

Os dois botoes ficarao empilhados verticalmente (`flex-col`) em um container compacto:

```text
[Cobrar via WhatsApp]        <- verde, sempre ativo (link)
[Enviar Cobranca]            <- primario quando conectado, desativado/opaco quando nao
```

### Validacao de DDD no botao de link

O botao "Cobrar via WhatsApp" ja abre o MessagePreviewDialog em modo `whatsapp_link`, onde a validacao de DDD ja existe (implementada anteriormente). Nao e necessario mudanca adicional para isso.

### Arquivos backend

Nenhum arquivo backend precisa ser alterado.

---

# Templates Prontos de Mensagem de Cobranca ✅ IMPLEMENTADO

Templates prontos foram adicionados para Atraso, Vence Hoje e Antecipada, incluindo opcao "Apenas Juros" em todos os tipos. O usuario pode selecionar via dropdown e continuar editando.
