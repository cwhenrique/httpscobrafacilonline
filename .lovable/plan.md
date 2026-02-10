
## Plano: Envio Automático de Cobranças para Clientes via WhatsApp

### Contexto
Os relatórios diários (`daily-summary`) são enviados apenas para o próprio cobrador. O objetivo é criar um sistema que envie **automaticamente** lembretes de cobrança direto para os clientes quando a instância WhatsApp estiver conectada.

> ⚠️ **Nota**: A política atual exige disparo manual. Este plano propõe envio automático **controlado por opt-in** do usuário.

---

### Fase 1: Configuração e Opt-in

#### 1.1 - Migration: novas colunas no `profiles`
- `auto_client_reports_enabled` (boolean, default false)
- `auto_report_hour` (integer, default 8) — horário do envio
- `auto_report_types` (text[], default `{'due_today','overdue'}`)

#### 1.2 - UI em Configurações (Settings)
- Toggle "Envio Automático de Cobranças para Clientes"
- Seletor de horário
- Checkboxes: "Vence Hoje", "Em Atraso"
- Aviso: "Mensagens enviadas automaticamente para clientes com número cadastrado"

---

### Fase 2: Edge Function `auto-client-billing`

#### 2.1 - Lógica principal
1. Busca usuários com `auto_client_reports_enabled = true`, WhatsApp conectado, plano ativo
2. Para cada usuário, busca empréstimos/veículos/produtos com parcelas pendentes
3. Para cada cliente com parcela pendente, monta mensagem usando templates do `billing_message_config`
4. Envia via Evolution API com credenciais do usuário
5. Registra em `whatsapp_messages`

#### 2.2 - Proteções Anti-Spam
- Máx 1 mensagem/cliente/dia (verificar `whatsapp_messages`)
- Máx 50 mensagens/usuário/execução
- Horário comercial (8h-20h), sem domingos
- Cooldown 2s entre mensagens
- Verificação de status da instância antes do envio

#### 2.3 - Templates
- Reutiliza `billing_message_config` existente
- Variáveis: `{CLIENTE}`, `{VALOR}`, `{VENCIMENTO}`, `{PIX}`, `{PROGRESSO}`
- Fallback para template padrão

---

### Fase 3: Cron Jobs

```sql
-- Cobrança automática 8h BRT (11h UTC), seg-sáb
select cron.schedule('auto-client-billing-8h', '0 11 * * 1-6', $$
  select net.http_post(
    url:='https://yulegybknvtanqkipsbj.supabase.co/functions/v1/auto-client-billing',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer ..."}'::jsonb,
    body:='{"targetHour":8,"batch":0,"batchSize":3}'::jsonb
  );
$$);
```

Batches adicionais (batch 1, 2, 3...) escalonados em 1 minuto de intervalo.

---

### Fase 4: Verificação de Conexão

Antes de enviar:
1. Conferir `whatsapp_instance_id` e `whatsapp_connected_phone`
2. (Opcional) Chamar `whatsapp-check-status` para confirmar conexão ativa
3. Se desconectado → pular usuário

---

### Fase 5: Monitoramento

- No relatório diário (self-message), adicionar:
  `"✅ Cobranças automáticas: X mensagens enviadas para Y clientes"`
- Logs detalhados na Edge Function

---

### Ordem de Implementação

| # | Etapa | Esforço |
|---|-------|---------|
| 1 | Migration: colunas no profiles | Pequeno |
| 2 | UI toggle em Settings | Médio |
| 3 | Edge Function `auto-client-billing` | Grande |
| 4 | Proteções anti-spam | Médio |
| 5 | Cron jobs | Pequeno |
| 6 | Testes com `testPhone` | Médio |
| 7 | Integração com relatório diário | Pequeno |

### Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Ban do WhatsApp | Cooldown, limite diário, horário comercial |
| Msg duplicada | Check `whatsapp_messages` antes de enviar |
| Instância offline | Pré-verificação de status |
| Timeout | Batch processing (3 usuários/exec) |
| Template errado | Fallback para mensagem padrão |
