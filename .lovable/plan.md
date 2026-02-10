
## Plano: Relatórios Diários via WhatsApp para o Cobrador

### Contexto
O sistema envia relatórios diários (daily-summary) para o próprio cobrador via WhatsApp, informando quais clientes ele precisa cobrar naquele dia. O usuário configura os horários desejados na página de Configurações.

### Status: ✅ Corrigido (2026-02-10)

#### Problemas identificados e corrigidos:
1. **Cron job das 8h sem batching** — tentava processar 282+ usuários em uma chamada → timeout
2. **Cron jobs sem `targetHour`** — não filtrava por horário configurado do usuário
3. **Faltavam cron jobs** para horários além de 8h e 12h (7, 9, 13, 14, 17, 18, 19)

#### Solução implementada:
- 270 cron jobs criados (9 horários × 30 batches × batchSize=10)
- Cada cron passa `targetHour` correto para filtrar usuários
- Horários BRT → UTC: 7→10, 8→11, 9→12, 12→15, 13→16, 14→17, 17→20, 18→21, 19→22
- Usuários sem configuração recebem nos horários padrão (8h e 12h)
- Rodapé mostra horário real do envio

### Configuração do Usuário
- Página Settings → "Receber Relatórios Diários"
- Horários disponíveis: 7, 8, 9, 12, 13, 14, 17, 18, 19
- Padrão para quem não configura: 8h e 12h
