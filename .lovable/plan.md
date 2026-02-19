

# Ajustar Textos da Pagina de Relatorios Automaticos

## Resumo

Atualizar os textos da pagina `src/pages/AutoReports.tsx` para refletir que:
- Os relatorios sao enviados via API oficial do WhatsApp
- O usuario recebe uma vez por dia, de um numero nosso, a lista de quem cobrar naquele dia e quem esta em atraso
- O usuario pode definir o horario de recebimento
- Isso e uma parceria com o WhatsApp

## Alteracoes no arquivo `src/pages/AutoReports.tsx`

### Card de Status (nao assinado)
- Texto atual: "Assine para receber relatórios automáticos via WhatsApp"
- Novo texto: "Assine para receber diariamente a lista de cobranças do dia via API oficial do WhatsApp"

### Card CTA principal
- Titulo atual: "Relatórios Automáticos via WhatsApp"
- Novo titulo: "Relatorio Diario de Cobranças via WhatsApp"
- Descricao atual: "Receba relatórios detalhados sobre empréstimos, produtos, contratos e IPTV diretamente no seu WhatsApp. Escolha a frequência: diário, semanal, quinzenal ou mensal."
- Nova descricao: "Receba uma vez por dia, de um numero nosso via API oficial do WhatsApp, a lista completa de quem voce deve cobrar naquele dia e quem esta em atraso. Voce define o horario de recebimento. Servico em parceria com WhatsApp."

### Titulo da pagina
- Subtitulo atual: "Receba relatórios completos via WhatsApp automaticamente"
- Novo subtitulo: "Receba diariamente no seu WhatsApp quem cobrar e quem esta em atraso"

### Secao de Frequencia
- Remover opcoes de frequencia (diario/semanal/quinzenal/mensal) e substituir por um seletor de horario de recebimento, ja que o envio e uma vez por dia

### Card de Status (assinado)
- Texto atual: "Seus relatórios estão sendo enviados automaticamente"
- Novo texto: "Voce recebe diariamente via API oficial do WhatsApp a lista de cobranças do dia"

