

# Migrar WhatsApp para Clientes para Meu Perfil

## Objetivo

Mover toda a seção de conexão "WhatsApp para Clientes" da página de Configurações (`Settings.tsx`) para a página Meu Perfil (`Profile.tsx`), facilitando a identificação e conexão pelo usuário. Em Configurações, deixar apenas um aviso informando que a área foi migrada.

## Alterações

### 1. Profile.tsx - Adicionar Seção WhatsApp para Clientes

**Novos imports necessários:**
- `Wifi`, `WifiOff`, `RefreshCw`, `Unplug`, `Timer`, `Smartphone`, `Camera`, `FileText` de `lucide-react`
- `Switch` de `@/components/ui/switch`
- `Progress` de `@/components/ui/progress`
- `DialogDescription` de `@/components/ui/dialog`

**Novos estados a adicionar:**
- `whatsappStatus` - Status da conexão WhatsApp
- `checkingStatus` - Verificando status
- `showQrModal` - Modal do QR Code
- `qrCode` - QR Code base64
- `generatingQr` - Gerando QR
- `disconnecting` - Desconectando
- `sendToClientsEnabled` - Enviar para clientes habilitado
- `qrTimeRemaining` - Tempo restante do QR
- `qrExpired` - QR expirado
- `reconnecting` - Reconectando
- `resettingInstance` - Recriando instância
- `sendingDailyTest` - Enviando relatório diário

**Novas funções a adicionar:**
- `checkWhatsAppStatus` - Verificar status da conexão
- `handleReconnectWhatsApp` - Tentar reconectar
- `handleConnectWhatsApp` - Conectar (gerar QR)
- `handleRefreshQrCode` - Atualizar QR Code
- `handleResetInstance` - Recriar instância
- `handleDisconnectWhatsApp` - Desconectar
- `handleToggleSendToClients` - Toggle enviar para clientes
- `handleTestDailySummary` - Testar relatório diário
- `formatPhoneDisplay` - Formatar telefone para exibição
- `getConnectedDays` - Dias conectado

**Nova seção visual:**
Inserir a seção completa de "WhatsApp para Clientes" logo antes do card "Teste de Notificações WhatsApp" (aproximadamente linha 1059), incluindo:
- Card com status de conexão (conectado/desconectado)
- Estado conectado: info do número, switch de enviar para clientes, botão de relatório diário, botões de recriar e desconectar
- Estado desconectado: botão para conectar, status de conexão pendente
- Modal de QR Code com timer e instruções

### 2. Settings.tsx - Substituir por Aviso de Migração

Substituir toda a seção "WhatsApp para Clientes" (linhas 676-923) por um card simples com aviso:

```text
+--------------------------------------------------+
|  MessageCircle  WhatsApp para Clientes           |
|--------------------------------------------------|
|  ℹ️ Esta funcionalidade foi movida               |
|                                                  |
|  A conexão e configuração do WhatsApp para      |
|  enviar mensagens aos seus clientes agora está  |
|  disponível na página Meu Perfil.               |
|                                                  |
|  [ Ir para Meu Perfil ]                         |
+--------------------------------------------------+
```

O botão redirecionará para `/profile`.

### 3. Remover Código Desnecessário de Settings.tsx

Após a substituição, as seguintes partes podem ser removidas de Settings.tsx:
- Estados de WhatsApp QR Code (linhas 62-77)
- Funções de WhatsApp (linhas 100-168, 170-191, 193-273, 275-354, 356-407)
- Modal de QR Code (linhas 1021-1203)
- Imports não utilizados

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Profile.tsx` | Adicionar seção completa de WhatsApp para Clientes antes de "Teste de Notificações" |
| `src/pages/Settings.tsx` | Substituir seção WhatsApp por aviso de migração e remover código relacionado |

## Fluxo do Usuário

**Antes:**
1. Usuário vai em Configurações
2. Procura WhatsApp para Clientes
3. Conecta por lá

**Depois:**
1. Usuário vai em Meu Perfil
2. Encontra WhatsApp para Clientes em destaque
3. Conecta facilmente
4. Se for em Configurações, vê aviso apontando para Perfil

## Benefícios

- Perfil fica como "central de controle" do usuário
- Mais intuitivo - tudo sobre "mim" em um lugar
- Configurações fica mais leve
- Reduz confusão de onde conectar WhatsApp

