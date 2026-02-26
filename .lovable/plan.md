

## Diagnóstico Atual

Analisei toda a infraestrutura de relatórios diários. Aqui está o cenário completo:

### Assinantes ativos (19 usuários)

| Usuário | Horário definido | Categorias |
|---|---|---|
| Vinicius Oliveira | 05h | loans, products, contracts, iptv |
| Alexsandro junior | 06h | loans |
| MAX | 06h | loans, contracts |
| ROBERVAN SANTIAGO | 08h | loans, contracts |
| VITAL'S. SA | 08h | loans, contracts |
| Luiz Algustu | 08h | loans |
| João Silva | 08h | loans |
| DARIO LEAL | 08h | loans |
| Davi Antunes | 08h | loans |
| Tony Montana Cash | 08h | loans |
| henriquelima | 09h | loans |
| Welton Felipe | 10h | loans |
| LUCIAN LIMA | 10h | loans, contracts, products, iptv |
| Cred prime | 11h | loans, contracts |
| Cred mais | 11h | loans, contracts |
| Gerente (Diego Reis) | 11h | loans |
| Kaique Lima | 11h | loans, products, contracts, iptv |
| Grupo Financeiro | 19h | loans |
| Henrique | 19h | loans |

### Problemas identificados

1. **Luiz Algustu** tem `report_schedule_hours = []` (vazio), o que faz ele cair nos horários padrão 8h/12h em vez de respeitar apenas o `auto_report_hour = 8`
2. **VITAL'S. SA** tem `report_schedule_hours = [7,8,9,12,13,14,17,18,19]` — recebe em 9 horários diferentes, provavelmente errado (deveria ser apenas no horário `auto_report_hour = 8`)
3. **Cron jobs duplicados**: Existem crons antigos (`ds-h*`) e novos (`daily-summary-h*-b*`) para os mesmos horários, causando execuções duplicadas
4. **Deduplicação frágil**: A lógica atual só bloqueia se houver um `pending` ativo, mas com crons duplicados o template pode ser enviado 2x antes da dedup funcionar

### Plano de Correções

#### 1. Limpar dados inconsistentes no banco
- Sincronizar `report_schedule_hours` com `auto_report_hour` para todos os usuários (cada um recebe apenas no horário que definiu)
- Corrigir Luiz Algustu: `report_schedule_hours = [8]`
- Corrigir VITAL'S. SA: `report_schedule_hours = [8]` (alinhado com seu `auto_report_hour`)

#### 2. Remover cron jobs duplicados
- Deletar os crons antigos `ds-h*` (456-482) que duplicam os `daily-summary-h*-b*`
- Manter apenas os crons `daily-summary-h*-b0/b1/b2` para cada hora

#### 3. Simplificar a lógica no `daily-summary/index.ts`
- O `report_schedule_hours` deve ser tratado como janela diária recorrente — todo dia no horário marcado o relatório é **gerado do zero** e enviado
- Remover a lógica de DEFAULT_HOURS `[8, 12]` — se o usuário não tem schedule, usar `auto_report_hour` como fonte de verdade
- Garantir que o relatório é sempre recalculado (dados atualizados) antes de enviar

#### 4. Garantir sincronização automática na página de configuração
- Quando o usuário salva o horário na tela `AutoReports.tsx`, garantir que `report_schedule_hours` é sempre `[auto_report_hour]` (já funciona no código atual)

### Detalhes técnicos

**SQL para corrigir dados:**
```sql
-- Sincronizar report_schedule_hours para todos assinantes
UPDATE profiles 
SET report_schedule_hours = ARRAY[auto_report_hour]
WHERE relatorio_ativo = true;

-- Remover cron jobs duplicados antigos (ds-h*)
SELECT cron.unschedule(jobid) FROM cron.job 
WHERE jobname LIKE 'ds-h%';
```

**Edge Function (`daily-summary/index.ts`):**
- Remover fallback `DEFAULT_HOURS = [8, 12]`
- Usar `auto_report_hour` como fallback quando `report_schedule_hours` está vazio
- O relatório já é gerado do zero a cada execução (queries frescas)

