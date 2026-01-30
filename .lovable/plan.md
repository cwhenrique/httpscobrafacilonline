

# Plano: Remover Sistema de Notificações In-App

## Contexto do Problema

O sistema atual cria notificações in-app (dentro do aplicativo) que ficam alertando sobre atrasos mesmo quando os empréstimos não estão realmente em atraso. As mensagens do WhatsApp **NÃO** serão afetadas.

## O que será removido

### 1. Componente NotificationCenter
O ícone de sino (🔔) no header que mostra as notificações será removido.

### 2. Hook useOverdueNotifications
O código que detecta empréstimos em atraso e cria notificações in-app no Dashboard.

### 3. Notificações das Edge Functions
Remover a criação de notificações in-app das seguintes funções (mantendo os envios de WhatsApp):

| Edge Function | O que faz | O que será removido |
|---------------|-----------|---------------------|
| check-overdue-loans | Verifica empréstimos em atraso | Notificações in-app |
| check-overdue-contracts | Verifica contratos em atraso | Notificações in-app |
| check-overdue-vehicles | Verifica veículos em atraso | Notificações in-app |
| check-bills-due | Verifica contas vencendo | Notificações in-app |
| check-loan-reminders | Lembretes de empréstimos | Notificações in-app |
| check-contract-reminders | Lembretes de contratos | Notificações in-app |
| check-vehicle-reminders | Lembretes de veículos | Notificações in-app |
| check-subscription-expiring | Assinatura expirando | Notificações in-app |
| check-expired-pending-messages | Mensagens expiradas | Notificações in-app |

## O que NÃO será afetado

- ✅ Mensagens de WhatsApp continuarão funcionando normalmente
- ✅ Toasts (avisos temporários na tela) continuarão funcionando
- ✅ Todas as demais funcionalidades do sistema

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| src/components/NotificationCenter.tsx | Excluir |
| src/hooks/useNotifications.ts | Excluir |
| src/hooks/useOverdueNotifications.ts | Excluir |
| src/components/layout/DashboardLayout.tsx | Remover referências |
| src/pages/Dashboard.tsx | Remover uso do hook |
| Todas as 9 edge functions listadas | Remover inserções em `notifications` |

## Observação sobre a tabela `notifications`

A tabela `notifications` no banco de dados permanecerá intacta. Você pode optar por limpar os dados antigos posteriormente ou manter para histórico.

