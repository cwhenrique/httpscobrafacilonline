

## Diagnóstico

O relatório do Pedro (pedro90006@gmail.com) não chega porque ele está na **posição 167** na fila de usuários, mas cada horário só tem **3 batches** (0, 1, 2) de 30 usuários cada, cobrindo apenas as posições 0-89. A base cresceu para **194 usuários** e precisa de pelo menos **7 batches** (0-6) por horário.

## Correção

Adicionar batches 3, 4, 5 e 6 para **todos os horários** (h06 até h19), criando os cron jobs faltantes.

Cada horário precisa:
- Batch 3: posições 90-119 (schedule: `3 HH * * *`)
- Batch 4: posições 120-149 (schedule: `4 HH * * *`)
- Batch 5: posições 150-179 (schedule: `5 HH * * *`)
- Batch 6: posições 180-209 (schedule: `6 HH * * *`)

Serão criados **4 novos cron jobs × 14 horários = 56 novos cron jobs** via SQL insert no `cron.schedule`.

### SQL a executar (via insert tool, não migration)

Para cada horário de h06 a h19, criar batches 3-6 com o pattern:

```sql
SELECT cron.schedule(
  'daily-summary-hHH-bN',
  'N UTC_HOUR * * *',
  $$SELECT net.http_post(
    url:='https://yulegybknvtanqkipsbj.supabase.co/functions/v1/daily-summary',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY"}'::jsonb,
    body:='{"targetHour":BRT_HOUR,"batch":N,"batchSize":30}'::jsonb
  ) as request_id;$$
);
```

Mapeamento horário BRT → UTC: h06=09, h07=10, h08=11, h09=12, h10=13, h11=14, h12=15, h13=16, h14=17, h15=18, h16=19, h17=20, h18=21, h19=22.

