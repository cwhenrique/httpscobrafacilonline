
# Plano: Agendamento de Relatórios Diários via WhatsApp

## Visão Geral

Adicionar na página de Perfil, logo abaixo da seção de WhatsApp conectado, uma nova seção para o usuário configurar os horários em que deseja receber o relatório atualizado de empréstimos. Os relatórios serão enviados automaticamente para o WhatsApp do usuário nos horários selecionados, enquanto a instância estiver conectada.

## Grupos de Horários

O usuário poderá selecionar um ou mais horários em três períodos:

| Período | Horários Disponíveis |
|---------|---------------------|
| **Manhã** | 07:00, 08:00, 09:00 |
| **Tarde** | 12:00, 13:00, 14:00 |
| **Fim do Dia** | 17:00, 18:00, 19:00 |

## Design da Interface

A seção aparecerá somente quando o WhatsApp estiver conectado e mostrará:

```
📅 Receber Relatórios Diários
Escolha os horários para receber seu relatório de cobranças automaticamente.

[Manhã]
☐ 07h  ☐ 08h  ☐ 09h

[Tarde]  
☐ 12h  ☐ 13h  ☐ 14h

[Fim do Dia]
☐ 17h  ☐ 18h  ☐ 19h
```

---

## Detalhamento Técnico

### 1. Alteração no Banco de Dados

Adicionar coluna `report_schedule_hours` na tabela `profiles`:

```sql
ALTER TABLE profiles 
ADD COLUMN report_schedule_hours integer[] DEFAULT '{}';
```

Esta coluna armazenará um array de inteiros representando os horários selecionados (ex: `[7, 8, 12, 17]` para 07h, 08h, 12h e 17h).

### 2. Atualização do Hook useProfile

Adicionar `report_schedule_hours` à interface `Profile` e ao `fetchProfile`.

### 3. Nova Seção na Página Profile.tsx

Inserir logo após a seção de "WhatsApp Conectado" (linhas ~1681):

- Card com título "Receber Relatórios Diários"
- Três grupos de checkboxes (Manhã, Tarde, Fim do Dia)
- Cada checkbox corresponde a um horário específico
- Ao marcar/desmarcar, salvar automaticamente no perfil

### 4. Modificação da Edge Function `daily-summary`

Atualizar para:

1. Receber o parâmetro `targetHour` indicando qual horário está sendo executado
2. Filtrar apenas usuários que têm esse horário em seu `report_schedule_hours`
3. Enviar apenas para usuários que optaram por aquele horário específico

### 5. Atualização dos Cron Jobs

Os cron jobs existentes (7h, 8h, 12h) precisarão ser atualizados para passar o parâmetro `targetHour` e adicionar os novos horários (9h, 13h, 14h, 17h, 18h, 19h).

---

## Fluxo de Funcionamento

```text
[Usuário conecta WhatsApp]
         ↓
[Nova seção de agendamento aparece]
         ↓
[Usuário seleciona: 08h, 12h, 18h]
         ↓
[Preferências salvas em profiles.report_schedule_hours = [8, 12, 18]]
         ↓
[Cron job às 08:00]
         ↓
[Edge function filtra: só usuários com 8 no array]
         ↓
[Relatório enviado apenas para quem escolheu 08h]
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `profiles` (banco) | Nova coluna `report_schedule_hours integer[]` |
| `src/hooks/useProfile.ts` | Adicionar campo ao tipo Profile |
| `src/pages/Profile.tsx` | Nova seção com checkboxes de horários |
| `supabase/functions/daily-summary/index.ts` | Filtrar por `targetHour` |
| Cron jobs no Supabase | Adicionar novos horários e parâmetro |

---

## Benefícios

1. **Controle total**: Usuário escolhe exatamente quando quer receber
2. **Flexibilidade**: Pode selecionar múltiplos horários
3. **Economia de recursos**: Só envia para quem realmente quer
4. **Experiência melhorada**: Não recebe relatórios indesejados
