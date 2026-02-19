
# Remover Seções de Relatório e Teste da Página de Perfil

## O que sera removido

Tres seções da pagina de Perfil serao removidas:

1. **"Testar Relatório Diário"** - O bloco com botao "Enviar Relatório de Teste" dentro do card de WhatsApp para Clientes
2. **"Receber Relatórios Diários"** - O card com checkboxes de horarios (Manha, Tarde, Fim do Dia)
3. **"Teste de Notificações WhatsApp"** - O card com botao "Enviar Teste para Meu WhatsApp"

## Detalhes tecnicos

### Arquivo: `src/pages/Profile.tsx`

- Remover o bloco "Testar Relatório Diário" (linhas 1652-1683)
- Remover o bloco ReportScheduleSection (linhas 1826-1834)
- Remover o card "Teste de Notificações WhatsApp" (linhas 1836-1876)
- Limpar imports nao utilizados: `ReportScheduleSection`, `FileText`, e o estado `sendingDailyTest`
- Remover a funcao `handleTestDailySummary` e `handleTestWhatsApp` (se nao for mais usada)
- Remover estado `sendingTest` (se nao for mais usado)

A pagina ficara com o card de WhatsApp para Clientes (conexao, QR Code, enviar para clientes, recriar instancia, desconectar) seguido diretamente pelo card de Alterar Senha.
